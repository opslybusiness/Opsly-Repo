"""
FastAPI backend for cold-email campaign management and automation
"""
import logging
import os
import sys
from fastapi import FastAPI, HTTPException, Depends, Body
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import uvicorn

# Configure logging for Vercel (logs to stdout/stderr)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)
logger.info("Starting Email Campaign API")


def _validate_required_env() -> None:
    """Fail fast on required configuration, including global SMTP fallback vars."""
    required = [
        "DATABASE_URL",
        "SUPABASE_JWT_SECRET",
        "GOOGLE_API_KEY",
        "SERPER_API_KEY",
    ]
    missing = [k for k in required if not os.getenv(k)]
    if missing:
        raise RuntimeError(
            "Missing required environment variables: " + ", ".join(missing)
        )

    smtp_required = [
        "SMTP_HOST",
        "SMTP_PORT",
        "SMTP_USER",
        "SMTP_PASSWORD",
        "EMAIL_FROM_NAME",
        "EMAIL_FROM_ADDRESS",
    ]
    missing_smtp = [k for k in smtp_required if not os.getenv(k)]
    if missing_smtp:
        raise RuntimeError(
            "Missing required SMTP environment variables: " + ", ".join(missing_smtp)
        )

from app.schemas import (
    HealthResponse,
    BusinessProfileCreate,
    BusinessProfileResponse,
    CampaignCreate,
    CampaignResponse,
    ProspectResponse,
    ProspectEmailUpdate,
    ManualProspectBulkRequest,
    ManualProspectBulkResponse,
    SentEmailResponse,
    SentEmailUpdateRequest,
    DiscoverRequest,
    SendEmailsResponse,
    CheckRepliesResponse,
    CampaignAnalyticsResponse,
    ReplyThreadResponse,
    JobSubmitResponse,
    JobStatusResponse,
    SuppressionCreate,
    SuppressionResponse,
)
from app.services.campaign_service import CampaignService
from app.services.job_service import JobService
from app.auth import get_user_id_from_token

app = FastAPI(
    title="Email Campaign API",
    description="FastAPI backend for cold-email campaign management, prospect discovery, and automation",
    version="1.0.0",
    redirect_slashes=False
)

origins = [
    "https://marketing-minds-three.vercel.app",
    "https://www.opslybusiness.me",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*", "Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
    expose_headers=["*"],
    max_age=3600,
)

# Initialize services
_validate_required_env()
campaign_service = CampaignService()
job_service = JobService()


@app.get("/", response_model=HealthResponse)
@app.get("", response_model=HealthResponse)
async def root():
    """Root endpoint - health check"""
    return HealthResponse(status="ok", message="Email Campaign API is running")


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(status="ok", message="Service is healthy")


# ===========================================================================
# Cold-Email Campaign Routes
# ===========================================================================

# --- Business Profiles ---

@app.post("/campaigns/profiles", response_model=BusinessProfileResponse, status_code=201)
async def create_business_profile(
    data: BusinessProfileCreate,
    user_id: str = Depends(get_user_id_from_token),
):
    """Create a business profile that represents the sender in outreach campaigns."""
    try:
        profile = campaign_service.create_business_profile(user_id, data.model_dump())
        return profile
    except Exception as exc:
        logger.error("Error creating business profile: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/campaigns/profiles", response_model=List[BusinessProfileResponse])
async def list_business_profiles(
    user_id: str = Depends(get_user_id_from_token),
):
    """List all business profiles belonging to the authenticated user."""
    try:
        return campaign_service.list_business_profiles(user_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.delete("/campaigns/profiles/{profile_id}")
async def delete_business_profile(
    profile_id: str,
    user_id: str = Depends(get_user_id_from_token),
):
    """Delete a business profile (and no longer available for new campaigns)."""
    deleted = campaign_service.delete_business_profile(user_id, profile_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Business profile not found")
    return {"status": "deleted"}


# --- Campaigns ---

@app.post("/campaigns", response_model=CampaignResponse, status_code=201)
async def create_campaign(
    data: CampaignCreate,
    user_id: str = Depends(get_user_id_from_token),
):
    """Create a new outreach campaign."""
    try:
        campaign = campaign_service.create_campaign(user_id, data.model_dump())
        return campaign
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Error creating campaign: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/campaigns", response_model=List[CampaignResponse])
async def list_campaigns(
    user_id: str = Depends(get_user_id_from_token),
):
    """List all campaigns for the authenticated user."""
    try:
        return campaign_service.list_campaigns(user_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/campaigns/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    campaign_id: str,
    user_id: str = Depends(get_user_id_from_token),
):
    """Get details of a specific campaign."""
    campaign = campaign_service.get_campaign(user_id, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@app.delete("/campaigns/{campaign_id}")
async def delete_campaign(
    campaign_id: str,
    user_id: str = Depends(get_user_id_from_token),
):
    """Delete a campaign and all its prospects / email records."""
    deleted = campaign_service.delete_campaign(user_id, campaign_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return {"status": "deleted"}


# --- Prospect Discovery ---

@app.post("/campaigns/{campaign_id}/discover", response_model=List[ProspectResponse])
async def discover_prospects(
    campaign_id: str,
    body: DiscoverRequest = Body(default=DiscoverRequest()),
    user_id: str = Depends(get_user_id_from_token),
):
    """
    Discover prospects for a campaign using Serper.dev Google Search API.
    This is an I/O-heavy operation and may take 10-60 seconds depending on search scope.
    """
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        prospects = await loop.run_in_executor(
            None,
            lambda: campaign_service.discover_prospects(
                user_id, campaign_id, body.max_results
            ),
        )
        return prospects
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Prospect discovery error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/campaigns/{campaign_id}/prospects", response_model=List[ProspectResponse])
async def list_prospects(
    campaign_id: str,
    user_id: str = Depends(get_user_id_from_token),
):
    """List all discovered prospects for a campaign."""
    try:
        return campaign_service.list_prospects(user_id, campaign_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.patch("/campaigns/{campaign_id}/prospects/{prospect_id}", response_model=ProspectResponse)
async def update_prospect_email(
    campaign_id: str,
    prospect_id: str,
    body: ProspectEmailUpdate,
    user_id: str = Depends(get_user_id_from_token),
):
    """Manually set or correct the contact email address for a prospect."""
    prospect = campaign_service.update_prospect_email(
        user_id, campaign_id, prospect_id, body.email
    )
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    return prospect


@app.post("/campaigns/{campaign_id}/prospects/manual", response_model=ManualProspectBulkResponse)
async def add_manual_prospects(
    campaign_id: str,
    body: ManualProspectBulkRequest,
    user_id: str = Depends(get_user_id_from_token),
):
    """Bulk intake manual prospects via JSON list and/or CSV payload."""
    try:
        result = campaign_service.add_manual_prospects(
            user_id=user_id,
            campaign_id=campaign_id,
            prospects=[item.model_dump() for item in (body.prospects or [])],
            csv_data=body.csv_data,
        )
        return ManualProspectBulkResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Manual prospect import error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/campaigns/{campaign_id}/discover-job", response_model=JobSubmitResponse)
async def discover_prospects_job(
    campaign_id: str,
    body: DiscoverRequest = Body(default=DiscoverRequest()),
    user_id: str = Depends(get_user_id_from_token),
):
    job_id = job_service.submit(
        "discover",
        lambda: campaign_service.discover_prospects(user_id, campaign_id, body.max_results),
    )
    return JobSubmitResponse(job_id=job_id, action="discover", status="queued")


# --- Email Generation ---

@app.post("/campaigns/{campaign_id}/generate-emails", response_model=List[SentEmailResponse])
async def generate_emails(
    campaign_id: str,
    user_id: str = Depends(get_user_id_from_token),
):
    """
    Generate personalised cold-email drafts (subject + body) for all prospects
    that have a contact email. Uses Gemini LLM for AI generation.
    """
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        emails = await loop.run_in_executor(
            None,
            lambda: campaign_service.generate_campaign_emails(user_id, campaign_id),
        )
        return emails
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Email generation error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/campaigns/{campaign_id}/generate-emails-job", response_model=JobSubmitResponse)
async def generate_emails_job(
    campaign_id: str,
    user_id: str = Depends(get_user_id_from_token),
):
    job_id = job_service.submit(
        "generate-emails",
        lambda: campaign_service.generate_campaign_emails(user_id, campaign_id),
    )
    return JobSubmitResponse(job_id=job_id, action="generate-emails", status="queued")


@app.get("/campaigns/{campaign_id}/emails", response_model=List[SentEmailResponse])
async def list_campaign_emails(
    campaign_id: str,
    user_id: str = Depends(get_user_id_from_token),
):
    """List all generated (and sent) email records for a campaign."""
    try:
        return campaign_service.list_campaign_emails(user_id, campaign_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.patch("/campaigns/{campaign_id}/emails/{email_id}", response_model=SentEmailResponse)
async def update_campaign_email(
    campaign_id: str,
    email_id: str,
    body: SentEmailUpdateRequest,
    user_id: str = Depends(get_user_id_from_token),
):
    """Edit a generated draft email before sending."""
    try:
        updated = campaign_service.update_campaign_email(
            user_id=user_id,
            campaign_id=campaign_id,
            sent_email_id=email_id,
            subject=body.subject,
            body=body.body,
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Email draft not found")
        return updated
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Update draft error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


# --- Sending ---

@app.post("/campaigns/{campaign_id}/send", response_model=SendEmailsResponse)
async def send_campaign_emails(
    campaign_id: str,
    user_id: str = Depends(get_user_id_from_token),
):
    """
    Send all pending email drafts for this campaign via SMTP.
    SMTP credentials are resolved from the business profile or environment variables.
    """
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: campaign_service.send_campaign_emails(user_id, campaign_id),
        )
        return SendEmailsResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Email send error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/campaigns/{campaign_id}/emails/{email_id}/send", response_model=SentEmailResponse)
async def send_single_campaign_email(
    campaign_id: str,
    email_id: str,
    user_id: str = Depends(get_user_id_from_token),
):
    """Send a single draft email for the selected campaign."""
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        row = await loop.run_in_executor(
            None,
            lambda: campaign_service.send_campaign_email(user_id, campaign_id, email_id),
        )
        if not row:
            raise HTTPException(status_code=404, detail="Email draft not found")
        return row
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Single email send error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/campaigns/{campaign_id}/send-job", response_model=JobSubmitResponse)
async def send_campaign_emails_job(
    campaign_id: str,
    user_id: str = Depends(get_user_id_from_token),
):
    job_id = job_service.submit(
        "send",
        lambda: campaign_service.send_campaign_emails(user_id, campaign_id),
    )
    return JobSubmitResponse(job_id=job_id, action="send", status="queued")


# --- Reply Checking ---

@app.post("/campaigns/{campaign_id}/check-replies", response_model=CheckRepliesResponse)
async def check_replies(
    campaign_id: str,
    user_id: str = Depends(get_user_id_from_token),
):
    """
    Poll the IMAP inbox for replies to sent emails and record them.
    Matches replies by In-Reply-To / References headers.
    """
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: campaign_service.check_replies(user_id, campaign_id),
        )
        return CheckRepliesResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Reply check error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/campaigns/{campaign_id}/check-replies-job", response_model=JobSubmitResponse)
async def check_replies_job(
    campaign_id: str,
    user_id: str = Depends(get_user_id_from_token),
):
    job_id = job_service.submit(
        "check-replies",
        lambda: campaign_service.check_replies(user_id, campaign_id),
    )
    return JobSubmitResponse(job_id=job_id, action="check-replies", status="queued")


@app.get("/campaign-jobs/{job_id}", response_model=JobStatusResponse)
async def get_campaign_job_status(job_id: str):
    payload = job_service.get(job_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobStatusResponse(**payload)


# --- Analytics ---

@app.get("/campaigns/{campaign_id}/analytics", response_model=CampaignAnalyticsResponse)
async def campaign_analytics(
    campaign_id: str,
    user_id: str = Depends(get_user_id_from_token),
):
    """Get engagement analytics for a campaign: prospects found, emails sent/failed/pending, reply rate."""
    try:
        data = campaign_service.get_analytics(user_id, campaign_id)
        return CampaignAnalyticsResponse(**data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/campaigns/{campaign_id}/reply-threads", response_model=List[ReplyThreadResponse])
async def campaign_reply_threads(
    campaign_id: str,
    user_id: str = Depends(get_user_id_from_token),
):
    """List outbound emails and their matched replies as conversation threads."""
    try:
        return campaign_service.list_reply_threads(user_id, campaign_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/campaigns/suppressions", response_model=SuppressionResponse, status_code=201)
async def add_suppression(
    body: SuppressionCreate,
    user_id: str = Depends(get_user_id_from_token),
):
    row = campaign_service.add_suppression(user_id, str(body.email), body.reason)
    return row


@app.get("/campaigns/suppressions", response_model=List[SuppressionResponse])
async def list_suppressions(
    user_id: str = Depends(get_user_id_from_token),
):
    return campaign_service.list_suppressions(user_id)


@app.delete("/campaigns/suppressions/{suppression_id}")
async def remove_suppression(
    suppression_id: str,
    user_id: str = Depends(get_user_id_from_token),
):
    deleted = campaign_service.remove_suppression(user_id, suppression_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Suppression entry not found")
    return {"status": "deleted"}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=True)

