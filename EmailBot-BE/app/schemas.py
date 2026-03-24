"""
Pydantic schemas for request/response models
"""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime


class HealthResponse(BaseModel):
    status: str
    message: str


class ChatMessageRequest(BaseModel):
    message: str = Field(..., description="User message")
    session_id: Optional[str] = Field(None, description="Optional client-side session ID (ignored, only used for response)")
    use_rag: bool = Field(True, description="Whether to use RAG for context retrieval")


class ChatMessageResponse(BaseModel):
    message: str = Field(..., description="AI response message")
    session_id: Optional[str] = Field(None, description="Client-side session identifier")
    sources: Optional[List[Dict[str, Any]]] = Field(default=[], description="Source documents used for RAG")


class ChatMessage(BaseModel):
    sender: str = Field(..., description="'user' or 'ai'")
    content: str
    timestamp: Optional[datetime] = None


class ChatSessionResponse(BaseModel):
    session_id: Optional[str] = Field(None, description="Client-side session identifier")
    created_at: Optional[datetime] = None
    message_count: int = 0
    messages: Optional[List[ChatMessage]] = None


class DocumentSearchResponse(BaseModel):
    id: str
    content: str
    similarity: float = Field(..., ge=0, le=1, description="Similarity score between 0 and 1")
    metadata: Optional[Dict[str, Any]] = None


class FileUploadResponse(BaseModel):
    file_id: Optional[str] = None
    filename: str
    chunks_created: int = 0
    status: str = Field(..., description="'success' or 'error'")
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Cold-Email Campaign Schemas
# ---------------------------------------------------------------------------

class BusinessProfileCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120, description="Your company or personal brand name")
    type: str = Field(..., min_length=2, max_length=80, description="Type of business, e.g. 'software company'")
    area_of_work: str = Field(..., min_length=2, max_length=120, description="Primary service/domain, e.g. 'web development'")
    location: str = Field(..., min_length=2, max_length=120, description="Your city or region")
    website: Optional[str] = None
    description: Optional[str] = Field(None, description="Short description used in email copy")
    contact_email: EmailStr = Field(..., description="Email address used as the From/Reply-To address")
    contact_name: str = Field(..., min_length=2, max_length=120, description="Your name for email sign-offs")
    # Optional per-profile SMTP override (falls back to global env vars when absent)
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = Field(
        None,
        description="SMTP password or App Password. Stored as plain text — use a dedicated app password.",
    )


class BusinessProfileResponse(BaseModel):
    id: str
    name: str
    type: str
    area_of_work: str
    location: str
    website: Optional[str] = None
    description: Optional[str] = None
    contact_email: str
    contact_name: str
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    # smtp_password intentionally excluded from responses
    created_at: datetime


class CampaignCreate(BaseModel):
    business_profile_id: str
    name: str = Field(..., min_length=2, max_length=120, description="Human-readable campaign label")
    target_industry: str = Field(..., min_length=3, max_length=120, description="Industry to target, e.g. 'restaurants'")
    target_location: str = Field(..., min_length=3, max_length=120, description="Target city/region, e.g. 'New York, NY'")
    target_keywords: str = Field(
        ..., min_length=5, max_length=250, description="Comma-separated search keywords, e.g. 'restaurant,food,catering'"
    )


class CampaignResponse(BaseModel):
    id: str
    name: str
    business_profile_id: str
    target_industry: str
    target_location: str
    target_keywords: str
    status: str
    prospects_found: int
    emails_sent: int
    replies_received: int
    created_at: datetime
    updated_at: datetime


class ProspectResponse(BaseModel):
    id: str
    campaign_id: str
    business_name: str
    website: Optional[str] = None
    email: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    status: str
    created_at: datetime


class ProspectEmailUpdate(BaseModel):
    email: EmailStr = Field(..., description="Manually provide / correct a contact email")


class ManualProspectItem(BaseModel):
    business_name: str = Field(..., min_length=2, max_length=180)
    email: Optional[EmailStr] = None
    website: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None


class ManualProspectBulkRequest(BaseModel):
    prospects: Optional[List[ManualProspectItem]] = Field(
        default=None,
        description="Prospect list in JSON format",
    )
    csv_data: Optional[str] = Field(
        default=None,
        description="CSV content with columns like business_name,email,website,location,description",
    )


class ManualProspectBulkResponse(BaseModel):
    created: int
    skipped: int
    prospects: List[ProspectResponse]


class SentEmailResponse(BaseModel):
    id: str
    campaign_id: str
    prospect_id: str
    subject: str
    body: str
    status: str
    sent_at: Optional[datetime] = None
    error: Optional[str] = None
    created_at: datetime


class SentEmailUpdateRequest(BaseModel):
    subject: str = Field(..., min_length=1, max_length=300)
    body: str = Field(..., min_length=1)


class ReplyMessage(BaseModel):
    from_email: str
    subject: str
    snippet: str
    received_at: Optional[str] = None


class ReplyThreadResponse(BaseModel):
    sent_email_id: str
    campaign_id: str
    prospect_id: str
    prospect_name: str
    prospect_email: Optional[str] = None
    outbound_subject: str
    outbound_body: str
    outbound_status: str
    outbound_sent_at: Optional[datetime] = None
    replies: List[ReplyMessage]


class DiscoverRequest(BaseModel):
    max_results: int = Field(default=20, ge=1, le=50, description="Max prospects to discover")


class SendEmailsResponse(BaseModel):
    sent: int
    failed: int


class CheckRepliesResponse(BaseModel):
    replies_found: int


class JobSubmitResponse(BaseModel):
    job_id: str
    action: str
    status: str


class JobStatusResponse(BaseModel):
    job_id: str
    action: str
    status: str
    created_at: str
    updated_at: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class SuppressionCreate(BaseModel):
    email: EmailStr
    reason: Optional[str] = None


class SuppressionResponse(BaseModel):
    id: str
    email: str
    reason: Optional[str] = None
    created_at: datetime


class CampaignAnalyticsResponse(BaseModel):
    campaign_id: str
    campaign_name: str
    status: str
    prospects: Dict[str, Any]
    emails: Dict[str, Any]
    engagement: Dict[str, Any]
    replies: List[Dict[str, Any]]
    summary: Optional[Dict[str, Any]] = None

