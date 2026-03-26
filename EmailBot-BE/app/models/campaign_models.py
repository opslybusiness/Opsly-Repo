"""
SQLModel database models for the automated cold email campaign system.
"""
import uuid
from typing import Optional
from datetime import datetime

from sqlalchemy import Column, Text
from sqlmodel import SQLModel, Field


class BusinessProfile(SQLModel, table=True):
    """Stores the sender's business identity and optional per-profile SMTP credentials."""
    __tablename__ = "business_profiles"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(index=True)

    # Business identity
    name: str
    type: str            # e.g. "software company", "marketing agency"
    area_of_work: str    # e.g. "web development", "digital marketing"
    location: str
    website: Optional[str] = None
    description: Optional[str] = None

    # Sender contact details
    contact_email: str   # sender's reply-to / from address
    contact_name: str    # sender's name used in email signatures

    # Optional per-profile SMTP overrides (fall back to global env vars when NULL)
    # SECURITY NOTE: smtp_password is stored as plain text.
    # Use an app-specific password (e.g. Gmail App Password) and restrict DB access.
    # In production, encrypt this column at rest.
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)


class Campaign(SQLModel, table=True):
    """Represents a cold-email outreach campaign tied to a business profile."""
    __tablename__ = "campaigns"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(index=True)
    business_profile_id: str = Field(foreign_key="business_profiles.id")

    name: str
    target_industry: str    # e.g. "restaurants"
    target_location: str    # e.g. "New York, NY"
    target_keywords: str    # comma-separated, e.g. "restaurant,food,catering"

    # Lifecycle: draft → discovering → active → completed
    status: str = Field(default="draft")

    # Counters (denormalised for quick analytics)
    prospects_found: int = Field(default=0)
    emails_sent: int = Field(default=0)
    replies_received: int = Field(default=0)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Prospect(SQLModel, table=True):
    """A business discovered as a potential cold-email target."""
    __tablename__ = "prospects"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    campaign_id: str = Field(foreign_key="campaigns.id", index=True)

    business_name: str
    website: Optional[str] = None
    email: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None

    # discovered → email_found → email_generated → sent → replied / bounced
    status: str = Field(default="discovered")

    created_at: datetime = Field(default_factory=datetime.utcnow)


class SentEmail(SQLModel, table=True):
    """Stores the generated email content and its send status for each prospect."""
    __tablename__ = "sent_emails"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    campaign_id: str = Field(foreign_key="campaigns.id", index=True)
    prospect_id: str = Field(foreign_key="prospects.id")

    subject: str
    body: str = Field(sa_column=Column(Text))

    # pending → sent / failed
    status: str = Field(default="pending")
    message_id: Optional[str] = None   # SMTP Message-ID header (for reply matching)
    sent_at: Optional[datetime] = None
    error: Optional[str] = None        # populated when status == "failed"

    created_at: datetime = Field(default_factory=datetime.utcnow)


class EmailEvent(SQLModel, table=True):
    """Audit log for per-email events: sent, replied, bounced."""
    __tablename__ = "email_events"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    sent_email_id: str = Field(foreign_key="sent_emails.id", index=True)
    campaign_id: str = Field(index=True)

    # send_attempt | sent | failed | replied | bounced
    event_type: str
    occurred_at: datetime = Field(default_factory=datetime.utcnow)
    details: Optional[str] = None   # JSON string for extra metadata (e.g. reply snippet)


class SuppressionEntry(SQLModel, table=True):
    """Campaign/user-level suppression list entry for do-not-contact addresses."""
    __tablename__ = "suppression_entries"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(index=True)
    email: str = Field(index=True)
    reason: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
