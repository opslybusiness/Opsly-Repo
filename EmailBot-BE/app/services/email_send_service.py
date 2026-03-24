"""
Email sending and reply-checking service.

Sending  – plain SMTP with STARTTLS (works with Gmail App Passwords, Outlook, etc.)
Replies  – IMAP inbox polling; matches replies by In-Reply-To / References header
           against the Message-IDs we generated when sending.

Global env vars (used when no per-profile overrides are supplied):
  SMTP_HOST          default smtp.gmail.com
  SMTP_PORT          default 587
  SMTP_USER          your SMTP login username (usually the email address)
  SMTP_PASSWORD      your SMTP password / app-specific password
  EMAIL_FROM_NAME    display name in the From header
  EMAIL_FROM_ADDRESS sender email address
  IMAP_HOST          default: SMTP_HOST with "smtp." replaced by "imap."
  IMAP_PORT          default 993
"""
import email as email_lib
import imaplib
import logging
import os
import re
import smtplib
import time
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, make_msgid
from typing import Dict, List, Optional, Tuple
from email_validator import EmailNotValidError, validate_email

logger = logging.getLogger(__name__)


class EmailSendService:
    # ------------------------------------------------------------------
    # Config resolution
    # ------------------------------------------------------------------

    def _smtp_cfg(self, profile: Optional[Dict] = None) -> Dict:
        """Merge per-profile SMTP overrides with global env-var defaults."""
        p = profile or {}
        return {
            "host": p.get("smtp_host") or os.getenv("SMTP_HOST", "smtp.gmail.com"),
            "port": int(p.get("smtp_port") or os.getenv("SMTP_PORT", "587")),
            "user": p.get("smtp_user") or os.getenv("SMTP_USER", ""),
            "password": p.get("smtp_password") or os.getenv("SMTP_PASSWORD", ""),
            "from_name": p.get("contact_name") or os.getenv("EMAIL_FROM_NAME", ""),
            "from_email": p.get("contact_email") or os.getenv("EMAIL_FROM_ADDRESS", ""),
        }

    def _imap_cfg(self, smtp_host: str) -> Tuple[str, int]:
        imap_host = os.getenv("IMAP_HOST") or smtp_host.replace("smtp.", "imap.", 1)
        imap_port = int(os.getenv("IMAP_PORT", "993"))
        return imap_host, imap_port

    @staticmethod
    def _normalize_message_id(value: str) -> str:
        """Normalize Message-ID style values for robust comparisons."""
        return (value or "").strip().strip("<>").lower()

    @staticmethod
    def _is_valid_email(address: str) -> bool:
        try:
            validate_email(address, check_deliverability=False)
            return True
        except (EmailNotValidError, ValueError):
            return False

    def validate_smtp_config(self, profile: Optional[Dict] = None) -> Tuple[bool, str]:
        """Validate resolved SMTP config before attempting a send batch."""
        cfg = self._smtp_cfg(profile)
        required = {
            "SMTP host": cfg.get("host"),
            "SMTP port": cfg.get("port"),
            "SMTP user": cfg.get("user"),
            "SMTP password": cfg.get("password"),
            "sender name": cfg.get("from_name"),
            "sender email": cfg.get("from_email"),
        }
        missing = [k for k, v in required.items() if not v]
        if missing:
            return False, f"Incomplete SMTP configuration: {', '.join(missing)}"
        if not self._is_valid_email(cfg["from_email"]):
            return False, "Sender email format is invalid"
        return True, ""

    # ------------------------------------------------------------------
    # Sending
    # ------------------------------------------------------------------

    def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        profile: Optional[Dict] = None,
    ) -> Tuple[bool, str, str]:
        """
        Send a single plain-text email via SMTP/STARTTLS.

        Returns (success, message_id, error_message).
        message_id is an RFC 2822 Message-ID string (including angle brackets).
        """
        cfg = self._smtp_cfg(profile)

        if not cfg["user"] or not cfg["password"]:
            return False, "", "SMTP credentials not configured"
        if not cfg["from_email"]:
            return False, "", "Sender email address not configured"
        if not self._is_valid_email(to_email):
            return False, "", f"Recipient email is invalid: {to_email}"
        if not (subject or "").strip():
            return False, "", "Email subject cannot be empty"
        if not (body or "").strip():
            return False, "", "Email body cannot be empty"

        # Build message
        msg = MIMEMultipart("alternative")
        msg["From"] = formataddr((cfg["from_name"], cfg["from_email"]))
        msg["To"] = to_email
        msg["Subject"] = subject
        message_id = make_msgid(domain=cfg["from_email"].split("@")[-1])
        msg["Message-ID"] = message_id
        msg.attach(MIMEText(body, "plain", "utf-8"))

        for attempt in range(3):
            try:
                with smtplib.SMTP(cfg["host"], cfg["port"], timeout=30) as server:
                    server.ehlo()
                    server.starttls()
                    server.login(cfg["user"], cfg["password"])
                    server.sendmail(cfg["from_email"], to_email, msg.as_string())
                logger.info("Sent email to %s  Message-ID: %s", to_email, message_id)
                return True, message_id, ""
            except smtplib.SMTPAuthenticationError:
                return False, "", "SMTP authentication failed - check credentials or use an App Password"
            except smtplib.SMTPRecipientsRefused:
                return False, "", f"Recipient refused: {to_email}"
            except (smtplib.SMTPConnectError, smtplib.SMTPServerDisconnected, TimeoutError) as exc:
                if attempt < 2:
                    time.sleep(0.5 * (attempt + 1))
                    continue
                logger.error("Transient SMTP connection error sending to %s: %s", to_email, exc)
                return False, "", str(exc)
            except smtplib.SMTPException as exc:
                logger.error("SMTP error sending to %s: %s", to_email, exc)
                return False, "", str(exc)
            except Exception as exc:
                logger.error("Unexpected send error: %s", exc)
                return False, "", str(exc)
        return False, "", "Send failed after retries"

    # ------------------------------------------------------------------
    # Reply checking
    # ------------------------------------------------------------------

    def check_replies(
        self,
        sent_message_ids: List[str],
        profile: Optional[Dict] = None,
        days_back: int = 30,
    ) -> List[Dict]:
        """
        Poll the IMAP inbox for replies to emails we sent.

        Matches by inspecting In-Reply-To and References headers.
        Returns a list of dicts:
          {in_reply_to, from_email, subject, body, received_at}
        """
        if not sent_message_ids:
            return []

        cfg = self._smtp_cfg(profile)
        if not cfg["user"] or not cfg["password"]:
            raise ValueError("IMAP credentials not configured")

        imap_host, imap_port = self._imap_cfg(cfg["host"])

        # Build a lookup set (strip angle brackets for comparison)
        sent_ids: Dict[str, str] = {
            self._normalize_message_id(mid): mid for mid in sent_message_ids
        }

        replies: List[Dict] = []
        since = (datetime.utcnow() - timedelta(days=days_back)).strftime("%d-%b-%Y")

        try:
            mail = imaplib.IMAP4_SSL(imap_host, imap_port)
            mail.login(cfg["user"], cfg["password"])
            mail.select("INBOX")

            _, nums = mail.search(None, f"SINCE {since}")
            for num in nums[0].split():
                try:
                    _, data = mail.fetch(num, "(RFC822)")
                    parsed = email_lib.message_from_bytes(data[0][1])
                    matched = self._match_reply(parsed, sent_ids)
                    if matched:
                        from_email = parsed.get("From", "")
                        if cfg["from_email"].lower() in from_email.lower():
                            continue
                        replies.append(
                            {
                                "in_reply_to": matched,   # original message_id (with brackets)
                                "from_email": from_email,
                                "subject": parsed.get("Subject", ""),
                                "body": self._extract_plain_body(parsed),
                                "received_at": parsed.get("Date", ""),
                            }
                        )
                except Exception as exc:
                    logger.warning("Error parsing inbox message %s: %s", num, exc)

            mail.logout()
        except imaplib.IMAP4.error as exc:
            logger.error("IMAP error: %s", exc)
            raise

        return replies

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _match_reply(msg, sent_ids: Dict[str, str]) -> Optional[str]:
        """
        Return the original message_id (with brackets) if this message is a
        reply to one of our sent emails, else None.
        """
        in_reply_raw = msg.get("In-Reply-To", "")
        tokens = re.findall(r"<([^>]+)>", in_reply_raw)
        if not tokens and in_reply_raw:
            tokens = [in_reply_raw]
        for token in tokens:
            clean = EmailSendService._normalize_message_id(token)
            if clean in sent_ids:
                return sent_ids[clean]

        refs_raw = msg.get("References", "")
        refs = re.findall(r"<([^>]+)>", refs_raw)
        if not refs and refs_raw:
            refs = refs_raw.split()
        for ref in refs:
            clean = EmailSendService._normalize_message_id(ref)
            if clean in sent_ids:
                return sent_ids[clean]

        return None

    @staticmethod
    def _extract_plain_body(msg) -> str:
        """Return the plain-text body of an email.Message, best-effort."""
        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_type() == "text/plain":
                    try:
                        return part.get_payload(decode=True).decode(
                            part.get_content_charset("utf-8"), errors="replace"
                        )
                    except Exception:
                        return ""
        else:
            try:
                charset = msg.get_content_charset("utf-8")
                return msg.get_payload(decode=True).decode(charset, errors="replace")
            except Exception:
                return ""
        return ""
