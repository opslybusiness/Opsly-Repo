"""
Campaign service — orchestrates the full cold-email pipeline:
  1. Business profile management
  2. Campaign CRUD
  3. Prospect discovery (search + email enrichment)
  4. Email generation per prospect (Gemini LLM)
  5. Email sending (SMTP)
  6. Reply checking (IMAP)
  7. Engagement analytics
"""
import csv
import io
import json
import logging
from collections import defaultdict, deque
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from email_validator import EmailNotValidError, validate_email
from sqlmodel import Session, select

from app.models.campaign_models import (
    BusinessProfile,
    Campaign,
    EmailEvent,
    Prospect,
    SentEmail,
    SuppressionEntry,
)
from app.services.email_gen_service import EmailGenService
from app.services.email_send_service import EmailSendService
from app.services.prospect_service import (
    enrich_prospect_email,
    is_junk_domain,
    normalize_domain,
    search_businesses,
)
from app.services.security_service import SecurityService

logger = logging.getLogger(__name__)


_DISCOVERY_CALLS = defaultdict(deque)
_SEND_CALLS = defaultdict(deque)

DISCOVERY_LIMIT_PER_MINUTE = 4
DISCOVERY_LIMIT_PER_HOUR = 20
SEND_LIMIT_PER_MINUTE = 30
SEND_LIMIT_PER_DAY = 500


def _engine():
    """Lazy import to avoid circular deps at module load time."""
    from embeddings_util import get_engine
    return get_engine()


def _ensure_tables():
    from sqlmodel import SQLModel
    # Importing the models registers them with SQLModel metadata
    import app.models.campaign_models  # noqa: F401
    SQLModel.metadata.create_all(_engine())


class CampaignService:
    def __init__(self):
        self.email_gen = EmailGenService()
        self.email_send = EmailSendService()
        self.security = SecurityService()
        _ensure_tables()

    @staticmethod
    def _normalize_email(email: Optional[str]) -> str:
        return (email or "").strip().lower()

    @staticmethod
    def _with_unsubscribe_footer(body: str) -> str:
        footer = "\n\n---\nTo unsubscribe from future emails, reply with 'unsubscribe'."
        if "unsubscribe" in (body or "").lower():
            return body
        return f"{body.rstrip()}{footer}"

    @staticmethod
    def _classify_bounce(error: str) -> str:
        text = (error or "").lower()
        if "auth" in text or "credential" in text:
            return "auth"
        if "recipient refused" in text or "user unknown" in text or "mailbox" in text:
            return "hard"
        return "soft"

    @staticmethod
    def _check_limit(bucket: deque, period_seconds: int, limit: int) -> bool:
        now = datetime.utcnow()
        cutoff = now - timedelta(seconds=period_seconds)
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= limit:
            return False
        bucket.append(now)
        return True

    def _enforce_discovery_limits(self, user_id: str) -> None:
        minute_bucket = _DISCOVERY_CALLS[f"{user_id}:m"]
        hour_bucket = _DISCOVERY_CALLS[f"{user_id}:h"]
        if not self._check_limit(minute_bucket, 60, DISCOVERY_LIMIT_PER_MINUTE):
            raise ValueError("Discovery rate limit exceeded: max calls per minute reached")
        if not self._check_limit(hour_bucket, 3600, DISCOVERY_LIMIT_PER_HOUR):
            raise ValueError("Discovery rate limit exceeded: max calls per hour reached")

    def _enforce_send_limits(self, user_id: str) -> None:
        minute_bucket = _SEND_CALLS[f"{user_id}:m"]
        day_bucket = _SEND_CALLS[f"{user_id}:d"]
        if not self._check_limit(minute_bucket, 60, SEND_LIMIT_PER_MINUTE):
            raise ValueError("Send rate limit exceeded: max sends per minute reached")
        if not self._check_limit(day_bucket, 86400, SEND_LIMIT_PER_DAY):
            raise ValueError("Send rate limit exceeded: max sends per day reached")

    def _smtp_profile_dict(self, profile: Optional[BusinessProfile]) -> Dict:
        if not profile:
            return {}
        return {
            "contact_name": profile.contact_name,
            "contact_email": profile.contact_email,
            "smtp_host": profile.smtp_host,
            "smtp_port": profile.smtp_port,
            "smtp_user": profile.smtp_user,
            "smtp_password": self.security.decrypt(profile.smtp_password),
        }

    # ==================================================================
    # Business Profiles
    # ==================================================================

    def create_business_profile(self, user_id: str, data: Dict) -> BusinessProfile:
        if data.get("smtp_password"):
            data["smtp_password"] = self.security.encrypt(data["smtp_password"])
        profile = BusinessProfile(user_id=user_id, **data)
        with Session(_engine()) as s:
            s.add(profile)
            s.commit()
            s.refresh(profile)
        return profile

    def list_business_profiles(self, user_id: str) -> List[BusinessProfile]:
        with Session(_engine()) as s:
            return list(
                s.exec(
                    select(BusinessProfile).where(BusinessProfile.user_id == user_id)
                ).all()
            )

    def get_business_profile(self, user_id: str, profile_id: str) -> Optional[BusinessProfile]:
        with Session(_engine()) as s:
            p = s.get(BusinessProfile, profile_id)
            return p if p and p.user_id == user_id else None

    def delete_business_profile(self, user_id: str, profile_id: str) -> bool:
        with Session(_engine()) as s:
            p = s.get(BusinessProfile, profile_id)
            if not p or p.user_id != user_id:
                return False
            s.delete(p)
            s.commit()
        return True

    # ==================================================================
    # Campaigns
    # ==================================================================

    def create_campaign(self, user_id: str, data: Dict) -> Campaign:
        with Session(_engine()) as s:
            profile = s.get(BusinessProfile, data.get("business_profile_id", ""))
            if not profile or profile.user_id != user_id:
                raise ValueError("Business profile not found or access denied")
            campaign = Campaign(user_id=user_id, **data)
            s.add(campaign)
            s.commit()
            s.refresh(campaign)
        return campaign

    def list_campaigns(self, user_id: str) -> List[Campaign]:
        with Session(_engine()) as s:
            return list(
                s.exec(
                    select(Campaign)
                    .where(Campaign.user_id == user_id)
                    .order_by(Campaign.created_at.desc())
                ).all()
            )

    def get_campaign(self, user_id: str, campaign_id: str) -> Optional[Campaign]:
        with Session(_engine()) as s:
            c = s.get(Campaign, campaign_id)
            return c if c and c.user_id == user_id else None

    def delete_campaign(self, user_id: str, campaign_id: str) -> bool:
        with Session(_engine()) as s:
            campaign = s.get(Campaign, campaign_id)
            if not campaign or campaign.user_id != user_id:
                return False
            # Cascade-delete related records (no FK cascade in SQLite/pgvector setup)
            prospects = s.exec(
                select(Prospect).where(Prospect.campaign_id == campaign_id)
            ).all()
            for prospect in prospects:
                sent_emails = s.exec(
                    select(SentEmail).where(SentEmail.prospect_id == prospect.id)
                ).all()
                for sent in sent_emails:
                    for ev in s.exec(
                        select(EmailEvent).where(EmailEvent.sent_email_id == sent.id)
                    ).all():
                        s.delete(ev)
                    s.delete(sent)
                s.delete(prospect)
            # Also delete any EmailEvents that reference campaign directly
            for ev in s.exec(
                select(EmailEvent).where(EmailEvent.campaign_id == campaign_id)
            ).all():
                s.delete(ev)
            s.delete(campaign)
            s.commit()
        return True

    # ==================================================================
    # Prospect Discovery
    # ==================================================================

    def discover_prospects(
        self, user_id: str, campaign_id: str, max_results: int = 20
    ) -> List[Prospect]:
        if max_results < 1 or max_results > 50:
            raise ValueError("max_results must be between 1 and 50")
        self._enforce_discovery_limits(user_id)

        with Session(_engine()) as s:
            campaign = s.get(Campaign, campaign_id)
            if not campaign or campaign.user_id != user_id:
                raise ValueError("Campaign not found or access denied")

            campaign.status = "discovering"
            campaign.updated_at = datetime.utcnow()
            s.add(campaign)
            s.commit()

            query = f"{campaign.target_industry} {campaign.target_keywords}"
            raw_list = search_businesses(query, campaign.target_location, max_results)
            logger.info(f"[DISCOVER] Serper returned {len(raw_list)} raw results for query='{query[:50]}...'")

            existing_prospects = s.exec(
                select(Prospect).where(Prospect.campaign_id == campaign_id)
            ).all()
            existing_domains = {normalize_domain(p.website) for p in existing_prospects if p.website}
            existing_emails = {self._normalize_email(p.email) for p in existing_prospects if p.email}
            existing_names = {(p.business_name or "").strip().lower() for p in existing_prospects}

            saved: List[Prospect] = []
            for raw in raw_list:
                enriched = enrich_prospect_email(raw)
                domain = normalize_domain(enriched.get("website"))
                email_key = self._normalize_email(enriched.get("email"))
                name_key = (enriched.get("business_name") or "Unknown").strip().lower()

                if not name_key:
                    name_key = "unknown"
                if domain and is_junk_domain(domain):
                    continue
                if email_key and is_junk_domain(email_key.split("@")[-1]):
                    continue
                if (domain and domain in existing_domains) or (email_key and email_key in existing_emails):
                    continue
                if not domain and not email_key and name_key in existing_names:
                    continue

                prospect = Prospect(
                    campaign_id=campaign_id,
                    business_name=enriched.get("business_name") or "Unknown",
                    website=enriched.get("website"),
                    email=enriched.get("email"),
                    location=enriched.get("location"),
                    description=enriched.get("description"),
                    status="email_found" if enriched.get("email") else "discovered",
                )
                s.add(prospect)
                saved.append(prospect)
                if domain:
                    existing_domains.add(domain)
                if email_key:
                    existing_emails.add(email_key)
                existing_names.add(name_key)

            campaign.status = "active"
            campaign.prospects_found = len(existing_prospects) + len(saved)
            campaign.updated_at = datetime.utcnow()
            s.add(campaign)
            s.commit()
            logger.info(f"[DISCOVER] Saved {len(saved)} prospects, total {campaign.prospects_found}, existing {len(existing_prospects)}")

            for p in saved:
                s.refresh(p)
        return saved

    def add_manual_prospects(
        self,
        user_id: str,
        campaign_id: str,
        prospects: Optional[List[Dict]] = None,
        csv_data: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload = list(prospects or [])
        if csv_data:
            reader = csv.DictReader(io.StringIO(csv_data))
            payload.extend(list(reader))
        if not payload:
            raise ValueError("Provide at least one prospect via prospects[] or csv_data")

        with Session(_engine()) as s:
            campaign = s.get(Campaign, campaign_id)
            if not campaign or campaign.user_id != user_id:
                raise ValueError("Campaign not found or access denied")

            existing = s.exec(select(Prospect).where(Prospect.campaign_id == campaign_id)).all()
            existing_domains = {normalize_domain(p.website) for p in existing if p.website}
            existing_emails = {self._normalize_email(p.email) for p in existing if p.email}

            created: List[Prospect] = []
            skipped = 0

            for raw in payload:
                name = (raw.get("business_name") or "").strip()
                if len(name) < 2:
                    skipped += 1
                    continue
                email = self._normalize_email(raw.get("email"))
                website = (raw.get("website") or "").strip() or None
                domain = normalize_domain(website)

                if email:
                    try:
                        validate_email(email, check_deliverability=False)
                    except EmailNotValidError:
                        skipped += 1
                        continue
                if domain and is_junk_domain(domain):
                    skipped += 1
                    continue
                if email and is_junk_domain(email.split("@")[-1]):
                    skipped += 1
                    continue
                if (domain and domain in existing_domains) or (email and email in existing_emails):
                    skipped += 1
                    continue

                prospect = Prospect(
                    campaign_id=campaign_id,
                    business_name=name,
                    email=email or None,
                    website=website,
                    location=(raw.get("location") or "").strip() or None,
                    description=(raw.get("description") or "").strip() or None,
                    status="manual_email_found" if email else "manual_discovered",
                )
                s.add(prospect)
                created.append(prospect)
                if domain:
                    existing_domains.add(domain)
                if email:
                    existing_emails.add(email)

            campaign.prospects_found = len(existing) + len(created)
            campaign.updated_at = datetime.utcnow()
            s.add(campaign)
            s.commit()
            for row in created:
                s.refresh(row)

        return {"created": len(created), "skipped": skipped, "prospects": created}

    def list_prospects(self, user_id: str, campaign_id: str) -> List[Prospect]:
        with Session(_engine()) as s:
            campaign = s.get(Campaign, campaign_id)
            if not campaign or campaign.user_id != user_id:
                raise ValueError("Campaign not found or access denied")
            return list(
                s.exec(select(Prospect).where(Prospect.campaign_id == campaign_id)).all()
            )

    def update_prospect_email(
        self, user_id: str, campaign_id: str, prospect_id: str, email: str
    ) -> Optional[Prospect]:
        with Session(_engine()) as s:
            campaign = s.get(Campaign, campaign_id)
            if not campaign or campaign.user_id != user_id:
                return None
            prospect = s.get(Prospect, prospect_id)
            if not prospect or prospect.campaign_id != campaign_id:
                return None
            prospect.email = email
            prospect.status = "email_found"
            s.add(prospect)
            s.commit()
            s.refresh(prospect)
        return prospect

    # ==================================================================
    # Email Generation
    # ==================================================================

    def generate_campaign_emails(
        self, user_id: str, campaign_id: str
    ) -> List[SentEmail]:
        with Session(_engine()) as s:
            campaign = s.get(Campaign, campaign_id)
            if not campaign or campaign.user_id != user_id:
                raise ValueError("Campaign not found or access denied")

            profile = s.get(BusinessProfile, campaign.business_profile_id)
            if not profile:
                raise ValueError("Business profile not found")

            prospects = s.exec(
                select(Prospect).where(
                    Prospect.campaign_id == campaign_id,
                    Prospect.email.is_not(None),
                )
            ).all()

            sender_dict = {
                "name": profile.name,
                "type": profile.type,
                "area_of_work": profile.area_of_work,
                "location": profile.location,
                "contact_name": profile.contact_name,
                "contact_email": profile.contact_email,
                "description": profile.description,
            }

            created: List[SentEmail] = []
            for prospect in prospects:
                # Skip if an email draft already exists for this prospect
                existing = s.exec(
                    select(SentEmail).where(
                        SentEmail.prospect_id == prospect.id,
                        SentEmail.campaign_id == campaign_id,
                    )
                ).first()
                if existing:
                    continue

                try:
                    result = self.email_gen.generate_cold_email(
                        sender_profile=sender_dict,
                        prospect={
                            "business_name": prospect.business_name,
                            "website": prospect.website,
                            "description": prospect.description,
                            "location": prospect.location,
                        },
                        campaign_context=f"Target industry: {campaign.target_industry}",
                    )
                    sent_email = SentEmail(
                        campaign_id=campaign_id,
                        prospect_id=prospect.id,
                        subject=result["subject"],
                        body=self._with_unsubscribe_footer(result["body"]),
                        status="pending",
                    )
                    s.add(sent_email)
                    prospect.status = "email_generated"
                    s.add(prospect)
                    created.append(sent_email)
                except Exception as exc:
                    logger.error(
                        "Email generation failed for prospect %s: %s", prospect.id, exc
                    )

            campaign.updated_at = datetime.utcnow()
            s.add(campaign)
            s.commit()

            for e in created:
                s.refresh(e)
        return created

    def list_campaign_emails(
        self, user_id: str, campaign_id: str
    ) -> List[SentEmail]:
        with Session(_engine()) as s:
            campaign = s.get(Campaign, campaign_id)
            if not campaign or campaign.user_id != user_id:
                raise ValueError("Campaign not found or access denied")
            return list(
                s.exec(
                    select(SentEmail).where(SentEmail.campaign_id == campaign_id)
                ).all()
            )

    def update_campaign_email(
        self,
        user_id: str,
        campaign_id: str,
        sent_email_id: str,
        subject: str,
        body: str,
    ) -> Optional[SentEmail]:
        with Session(_engine()) as s:
            campaign = s.get(Campaign, campaign_id)
            if not campaign or campaign.user_id != user_id:
                return None

            row = s.get(SentEmail, sent_email_id)
            if not row or row.campaign_id != campaign_id:
                return None

            # Editing is only allowed before successful send.
            if row.status == "sent":
                raise ValueError("Cannot edit an email after it has been sent")

            row.subject = (subject or "").strip()
            row.body = (body or "").strip()
            row.error = None
            row.status = "pending"
            s.add(row)
            s.commit()
            s.refresh(row)
            return row

    def list_reply_threads(self, user_id: str, campaign_id: str) -> List[Dict[str, Any]]:
        with Session(_engine()) as s:
            campaign = s.get(Campaign, campaign_id)
            if not campaign or campaign.user_id != user_id:
                raise ValueError("Campaign not found or access denied")

            prospects = s.exec(
                select(Prospect).where(Prospect.campaign_id == campaign_id)
            ).all()
            prospect_by_id = {p.id: p for p in prospects}

            sent_emails = s.exec(
                select(SentEmail).where(SentEmail.campaign_id == campaign_id)
            ).all()

            reply_events = s.exec(
                select(EmailEvent).where(
                    EmailEvent.campaign_id == campaign_id,
                    EmailEvent.event_type == "replied",
                )
            ).all()

            replies_by_sent_email: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
            for ev in reply_events:
                try:
                    detail = json.loads(ev.details) if ev.details else {}
                except Exception:
                    detail = {}
                replies_by_sent_email[ev.sent_email_id].append(
                    {
                        "from_email": detail.get("from", ""),
                        "subject": detail.get("subject", ""),
                        "snippet": detail.get("snippet", ""),
                        "received_at": detail.get("received_at") or (ev.occurred_at.isoformat() if ev.occurred_at else None),
                    }
                )

            threads: List[Dict[str, Any]] = []
            for email in sent_emails:
                prospect = prospect_by_id.get(email.prospect_id)
                thread_replies = sorted(
                    replies_by_sent_email.get(email.id, []),
                    key=lambda item: item.get("received_at") or "",
                )
                threads.append(
                    {
                        "sent_email_id": email.id,
                        "campaign_id": campaign_id,
                        "prospect_id": email.prospect_id,
                        "prospect_name": prospect.business_name if prospect else "Unknown prospect",
                        "prospect_email": prospect.email if prospect else None,
                        "outbound_subject": email.subject,
                        "outbound_body": email.body,
                        "outbound_status": email.status,
                        "outbound_sent_at": email.sent_at,
                        "replies": thread_replies,
                    }
                )

            threads.sort(
                key=lambda item: (
                    item["replies"][-1].get("received_at") if item["replies"] else "",
                    item["outbound_sent_at"].isoformat() if item["outbound_sent_at"] else "",
                ),
                reverse=True,
            )

            return threads

    # ==================================================================
    # Email Sending
    # ==================================================================

    def send_campaign_emails(
        self, user_id: str, campaign_id: str
    ) -> Dict[str, int]:
        self._enforce_send_limits(user_id)

        with Session(_engine()) as s:
            campaign = s.get(Campaign, campaign_id)
            if not campaign or campaign.user_id != user_id:
                raise ValueError("Campaign not found or access denied")

            profile = s.get(BusinessProfile, campaign.business_profile_id)
            profile_dict = self._smtp_profile_dict(profile)

            ok, err = self.email_send.validate_smtp_config(profile_dict)
            if not ok:
                raise ValueError(err)

            suppressed = {
                self._normalize_email(row.email)
                for row in s.exec(select(SuppressionEntry).where(SuppressionEntry.user_id == user_id)).all()
            }

            # Fetch pending emails joined with prospect (to get to_email)
            rows = s.exec(
                select(SentEmail, Prospect)
                .join(Prospect, SentEmail.prospect_id == Prospect.id)
                .where(
                    SentEmail.campaign_id == campaign_id,
                    SentEmail.status == "pending",
                )
            ).all()

            sent_count = 0
            failed_count = 0

            for sent_email, prospect in rows:
                recipient = self._normalize_email(prospect.email)
                if not recipient:
                    continue

                if recipient in suppressed:
                    sent_email.status = "failed"
                    sent_email.error = "Suppressed recipient"
                    failed_count += 1
                    s.add(
                        EmailEvent(
                            sent_email_id=sent_email.id,
                            campaign_id=campaign_id,
                            event_type="failed",
                            details=json.dumps({"reason": sent_email.error, "category": "suppressed"}),
                        )
                    )
                    s.add(sent_email)
                    continue

                if not sent_email.subject or not sent_email.subject.strip():
                    sent_email.status = "failed"
                    sent_email.error = "Empty subject"
                    failed_count += 1
                    s.add(
                        EmailEvent(
                            sent_email_id=sent_email.id,
                            campaign_id=campaign_id,
                            event_type="failed",
                            details=json.dumps({"reason": "Empty subject", "category": "validation"}),
                        )
                    )
                    s.add(sent_email)
                    continue

                if not sent_email.body or not sent_email.body.strip():
                    sent_email.status = "failed"
                    sent_email.error = "Empty body"
                    failed_count += 1
                    s.add(
                        EmailEvent(
                            sent_email_id=sent_email.id,
                            campaign_id=campaign_id,
                            event_type="failed",
                            details=json.dumps({"reason": "Empty body", "category": "validation"}),
                        )
                    )
                    s.add(sent_email)
                    continue

                s.add(
                    EmailEvent(
                        sent_email_id=sent_email.id,
                        campaign_id=campaign_id,
                        event_type="send_attempt",
                    )
                )

                success, message_id, error = self.email_send.send_email(
                    to_email=recipient,
                    subject=sent_email.subject,
                    body=sent_email.body,
                    profile=profile_dict,
                )

                if success:
                    sent_email.status = "sent"
                    sent_email.message_id = message_id
                    sent_email.sent_at = datetime.utcnow()
                    prospect.status = "sent"
                    s.add(
                        EmailEvent(
                            sent_email_id=sent_email.id,
                            campaign_id=campaign_id,
                            event_type="sent",
                            details=json.dumps({"message_id": message_id, "recipient": recipient}),
                        )
                    )
                    sent_count += 1
                else:
                    sent_email.status = "failed"
                    sent_email.error = error
                    s.add(
                        EmailEvent(
                            sent_email_id=sent_email.id,
                            campaign_id=campaign_id,
                            event_type="failed",
                            details=json.dumps(
                                {
                                    "reason": error,
                                    "category": self._classify_bounce(error),
                                    "recipient": recipient,
                                }
                            ),
                        )
                    )
                    failed_count += 1

                s.add(sent_email)
                s.add(prospect)

            campaign.emails_sent = (campaign.emails_sent or 0) + sent_count
            campaign.updated_at = datetime.utcnow()
            s.add(campaign)
            s.commit()

        return {"sent": sent_count, "failed": failed_count}

    def send_campaign_email(
        self, user_id: str, campaign_id: str, sent_email_id: str
    ) -> Optional[SentEmail]:
        self._enforce_send_limits(user_id)

        with Session(_engine()) as s:
            campaign = s.get(Campaign, campaign_id)
            if not campaign or campaign.user_id != user_id:
                raise ValueError("Campaign not found or access denied")

            profile = s.get(BusinessProfile, campaign.business_profile_id)
            profile_dict = self._smtp_profile_dict(profile)

            ok, err = self.email_send.validate_smtp_config(profile_dict)
            if not ok:
                raise ValueError(err)

            sent_email = s.get(SentEmail, sent_email_id)
            if not sent_email or sent_email.campaign_id != campaign_id:
                return None

            prospect = s.get(Prospect, sent_email.prospect_id)
            recipient = self._normalize_email(prospect.email if prospect else None)
            if not recipient:
                raise ValueError("Prospect does not have a valid email")

            suppressed = {
                self._normalize_email(row.email)
                for row in s.exec(select(SuppressionEntry).where(SuppressionEntry.user_id == user_id)).all()
            }
            if recipient in suppressed:
                sent_email.status = "failed"
                sent_email.error = "Suppressed recipient"
                s.add(
                    EmailEvent(
                        sent_email_id=sent_email.id,
                        campaign_id=campaign_id,
                        event_type="failed",
                        details=json.dumps({"reason": sent_email.error, "category": "suppressed"}),
                    )
                )
                s.add(sent_email)
                s.commit()
                s.refresh(sent_email)
                return sent_email

            if not sent_email.subject or not sent_email.subject.strip():
                raise ValueError("Email subject is required")
            if not sent_email.body or not sent_email.body.strip():
                raise ValueError("Email body is required")

            s.add(
                EmailEvent(
                    sent_email_id=sent_email.id,
                    campaign_id=campaign_id,
                    event_type="send_attempt",
                )
            )

            success, message_id, error = self.email_send.send_email(
                to_email=recipient,
                subject=sent_email.subject,
                body=sent_email.body,
                profile=profile_dict,
            )

            if success:
                sent_email.status = "sent"
                sent_email.message_id = message_id
                sent_email.sent_at = datetime.utcnow()
                sent_email.error = None
                if prospect:
                    prospect.status = "sent"
                    s.add(prospect)
                s.add(
                    EmailEvent(
                        sent_email_id=sent_email.id,
                        campaign_id=campaign_id,
                        event_type="sent",
                        details=json.dumps({"message_id": message_id, "recipient": recipient}),
                    )
                )
                campaign.emails_sent = (campaign.emails_sent or 0) + 1
            else:
                sent_email.status = "failed"
                sent_email.error = error
                s.add(
                    EmailEvent(
                        sent_email_id=sent_email.id,
                        campaign_id=campaign_id,
                        event_type="failed",
                        details=json.dumps(
                            {
                                "reason": error,
                                "category": self._classify_bounce(error),
                                "recipient": recipient,
                            }
                        ),
                    )
                )

            campaign.updated_at = datetime.utcnow()
            s.add(campaign)
            s.add(sent_email)
            s.commit()
            s.refresh(sent_email)
            return sent_email

    # ==================================================================
    # Reply Checking
    # ==================================================================

    def check_replies(
        self, user_id: str, campaign_id: str
    ) -> Dict[str, int]:
        with Session(_engine()) as s:
            campaign = s.get(Campaign, campaign_id)
            if not campaign or campaign.user_id != user_id:
                raise ValueError("Campaign not found or access denied")

            profile = s.get(BusinessProfile, campaign.business_profile_id)
            profile_dict: Dict = {}
            if profile:
                profile_dict = self._smtp_profile_dict(profile)

            sent_emails = s.exec(
                select(SentEmail).where(
                    SentEmail.campaign_id == campaign_id,
                    SentEmail.status == "sent",
                    SentEmail.message_id.is_not(None),
                )
            ).all()

            if not sent_emails:
                return {"replies_found": 0}

            # Map stripped message_id → SentEmail object
            id_map: Dict[str, SentEmail] = {e.message_id: e for e in sent_emails if e.message_id}

            replies = self.email_send.check_replies(
                sent_message_ids=list(id_map.keys()),
                profile=profile_dict,
            )

            new_replies = 0
            for reply in replies:
                sent_email = id_map.get(reply["in_reply_to"])
                if not sent_email:
                    continue

                # Idempotent: skip if already recorded
                signature = f"{reply.get('from_email','')}|{reply.get('subject','')}|{(reply.get('body') or '')[:120]}"
                existing_reply_events = s.exec(
                    select(EmailEvent).where(
                        EmailEvent.sent_email_id == sent_email.id,
                        EmailEvent.event_type == "replied",
                    )
                ).all()
                if any((ev.details or "").find(signature) >= 0 for ev in existing_reply_events):
                    continue

                s.add(
                    EmailEvent(
                        sent_email_id=sent_email.id,
                        campaign_id=campaign_id,
                        event_type="replied",
                        details=json.dumps(
                            {
                                "from": reply["from_email"],
                                "subject": reply["subject"],
                                "snippet": reply["body"][:300],
                                "received_at": reply.get("received_at", ""),
                                "signature": signature,
                            }
                        ),
                    )
                )

                prospect = s.get(Prospect, sent_email.prospect_id)
                if prospect and prospect.status != "replied":
                    prospect.status = "replied"
                    s.add(prospect)

                new_replies += 1

            campaign.replies_received = (campaign.replies_received or 0) + new_replies
            campaign.updated_at = datetime.utcnow()
            s.add(campaign)
            s.commit()

        return {"replies_found": new_replies}

    # ==================================================================
    # Analytics
    # ==================================================================

    def get_analytics(
        self, user_id: str, campaign_id: str
    ) -> Dict[str, Any]:
        with Session(_engine()) as s:
            campaign = s.get(Campaign, campaign_id)
            if not campaign or campaign.user_id != user_id:
                raise ValueError("Campaign not found or access denied")

            all_prospects = s.exec(
                select(Prospect).where(Prospect.campaign_id == campaign_id)
            ).all()
            total = len(all_prospects)
            with_email = sum(1 for p in all_prospects if p.email)

            def _count_emails(status: str) -> int:
                return len(
                    s.exec(
                        select(SentEmail).where(
                            SentEmail.campaign_id == campaign_id,
                            SentEmail.status == status,
                        )
                    ).all()
                )

            sent = _count_emails("sent")
            failed = _count_emails("failed")
            pending = _count_emails("pending")
            drafted = pending + sent + failed

            replied_count = sum(1 for p in all_prospects if p.status == "replied")

            reply_events = s.exec(
                select(EmailEvent).where(
                    EmailEvent.campaign_id == campaign_id,
                    EmailEvent.event_type == "replied",
                )
            ).all()

            reply_details = []
            for ev in reply_events:
                try:
                    detail = json.loads(ev.details) if ev.details else {}
                except Exception:
                    detail = {}
                reply_details.append(
                    {
                        "from": detail.get("from", ""),
                        "subject": detail.get("subject", ""),
                        "snippet": detail.get("snippet", ""),
                        "received_at": ev.occurred_at.isoformat()
                        if ev.occurred_at
                        else None,
                    }
                )

            return {
                "campaign_id": campaign_id,
                "campaign_name": campaign.name,
                "status": campaign.status,
                "prospects": {
                    "total": total,
                    "with_email": with_email,
                    "without_email": total - with_email,
                },
                "emails": {
                    "drafted": drafted,
                    "pending": pending,
                    "sent": sent,
                    "failed": failed,
                    "total": drafted,
                },
                "engagement": {
                    "replied": replied_count,
                    "reply_rate_percent": round(replied_count / sent * 100, 1)
                    if sent > 0
                    else 0.0,
                },
                "replies": reply_details[:20],
                "summary": {
                    "total_prospects": total,
                    "with_email": with_email,
                    "drafted": drafted,
                    "sent": sent,
                    "failed": failed,
                    "replied": replied_count,
                    "reply_rate": round(replied_count / sent * 100, 1) if sent > 0 else 0.0,
                    "recent_reply_snippets": [x.get("snippet", "") for x in reply_details[:5]],
                },
            }

    # ==================================================================
    # Suppression List
    # ==================================================================

    def add_suppression(self, user_id: str, email: str, reason: Optional[str] = None) -> SuppressionEntry:
        normalized = self._normalize_email(email)
        with Session(_engine()) as s:
            existing = s.exec(
                select(SuppressionEntry).where(
                    SuppressionEntry.user_id == user_id,
                    SuppressionEntry.email == normalized,
                )
            ).first()
            if existing:
                return existing
            row = SuppressionEntry(user_id=user_id, email=normalized, reason=reason)
            s.add(row)
            s.commit()
            s.refresh(row)
            return row

    def list_suppressions(self, user_id: str) -> List[SuppressionEntry]:
        with Session(_engine()) as s:
            return list(s.exec(select(SuppressionEntry).where(SuppressionEntry.user_id == user_id)).all())

    def remove_suppression(self, user_id: str, suppression_id: str) -> bool:
        with Session(_engine()) as s:
            row = s.get(SuppressionEntry, suppression_id)
            if not row or row.user_id != user_id:
                return False
            s.delete(row)
            s.commit()
            return True
