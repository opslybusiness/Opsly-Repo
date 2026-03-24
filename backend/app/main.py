from contextlib import asynccontextmanager
from urllib.parse import urlencode

from fastapi import FastAPI, Request, Depends
from fastapi.responses import RedirectResponse
import httpx
import os
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.auth import get_user_id_from_token
from datetime import datetime, timedelta, timezone
import requests
from app.routes.facebook_analytics import router as analytics_router
from app.routes.insta_analytics import router as insta_analytics_router
from app.routes.post_scheduling import router as scheduling_router
from app.routes.finance_forecasting import router as finance_forecasting_router
from app.routes.fraud_detection import router as fraud_detection_router
from app.routes.categories import router as categories_router
from app.routes.voice_bots import router as voice_bots_router
from fastapi.middleware.cors import CORSMiddleware
from uuid import UUID as UUIDType

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.scheduler_app import start_scheduler, shutdown_scheduler

    start_scheduler()
    yield
    shutdown_scheduler()


app = FastAPI(lifespan=lifespan)

origins = [
    "https://marketing-minds-three.vercel.app",
    "https://www.opslybusiness.me",
    "http://localhost:5173",
    "http://localhost:5174",
]

#cors 
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # or ["*"] to allow all
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(analytics_router)
app.include_router(scheduling_router)
app.include_router(insta_analytics_router)
app.include_router(finance_forecasting_router)
app.include_router(fraud_detection_router)
app.include_router(categories_router)
app.include_router(voice_bots_router)

FB_APP_ID    = os.getenv("FB_APP_ID")
FB_APP_SECRET = os.getenv("FB_APP_SECRET")
REDIRECT_URI  = os.getenv("REDIRECT_URI", "http://localhost:8000/auth/facebook/callback").strip().strip('"')
FRONTEND_URL  = os.getenv("FRONTEND_URL", "http://localhost:5173")

LINKEDIN_CLIENT_ID = os.getenv("LINKEDIN_CLIENT_ID")
LINKEDIN_CLIENT_SECRET = os.getenv("LINKEDIN_CLIENT_SECRET")
LINKEDIN_REDIRECT_URI = os.getenv(
    "LINKEDIN_REDIRECT_URI", "http://localhost:8000/auth/linkedin/callback"
).strip().strip('"')
LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
_LINKEDIN_SCOPES = "openid profile email w_member_social"

# Scopes required for reading pages, analytics AND publishing posts
_FB_SCOPES = (
    "pages_show_list,"
    "pages_read_engagement,"
    "pages_manage_posts,"
    "public_profile,"
    "business_management,"
   
)


@app.get("/auth/facebook/login")
def facebook_login(user_id: str = None):
    """
    Start Facebook OAuth flow.
    Pass the Supabase user_id as a query param so the callback can link accounts.
    """
    state = user_id or "anonymous"
    auth_url = (
        "https://www.facebook.com/v24.0/dialog/oauth"
        f"?client_id={FB_APP_ID}"
        f"&redirect_uri={REDIRECT_URI}"
        f"&state={state}"
        f"&scope={_FB_SCOPES}"
    )
    return RedirectResponse(auth_url)


@app.get("/auth/facebook/callback")
async def facebook_callback(request: Request, db: Session = Depends(get_db)):
    code  = request.query_params.get("code")
    state = request.query_params.get("state", "")   # contains Supabase user_id

    if not code:
        return RedirectResponse(f"{FRONTEND_URL}/marketing?error=facebook_denied")

    # Exchange code → short-lived token
    token_response = requests.get(
        "https://graph.facebook.com/v24.0/oauth/access_token",
        params={
            "client_id": FB_APP_ID,
            "redirect_uri": REDIRECT_URI,
            "client_secret": FB_APP_SECRET,
            "code": code,
        }
    ).json()

    if "access_token" not in token_response:
        return RedirectResponse(f"{FRONTEND_URL}/marketing?error=token_exchange_failed")

    short_token = token_response["access_token"]

    # Exchange short-lived → long-lived token (60-day)
    long_token_response = requests.get(
        "https://graph.facebook.com/v24.0/oauth/access_token",
        params={
            "grant_type": "fb_exchange_token",
            "client_id": FB_APP_ID,
            "client_secret": FB_APP_SECRET,
            "fb_exchange_token": short_token,
        }
    ).json()
    long_token = long_token_response.get("access_token", short_token)

    # Get Facebook user info
    user_data = requests.get(
        "https://graph.facebook.com/me",
        params={"fields": "id,name", "access_token": long_token}
    ).json()

    if "id" not in user_data:
        return RedirectResponse(f"{FRONTEND_URL}/marketing?error=user_info_failed")

    facebook_id = user_data["id"]
    name        = user_data.get("name")

    # Look up both possible rows upfront
    user_by_uid = None
    if state and state != "anonymous":
        try:
            user_uuid    = UUIDType(state)
            user_by_uid  = db.query(User).filter(User.user_id == user_uuid).first()
        except ValueError:
            pass

    user_by_fb = db.query(User).filter(User.facebook_id == facebook_id).first()

    if user_by_uid:
        # The authoritative row is the one tied to the Supabase user.
        # If a different orphan row already holds this facebook_id, clear it first
        # to avoid the unique-constraint violation.
        if user_by_fb and user_by_fb.id != user_by_uid.id:
            user_by_fb.facebook_id   = None
            user_by_fb.session_token = None
            db.flush()          # write the NULL before we set facebook_id on user_by_uid

        user_by_uid.facebook_id   = facebook_id
        user_by_uid.name          = name
        user_by_uid.session_token = long_token

    elif user_by_fb:
        # No Supabase user found; update the existing Facebook row
        user_by_fb.name          = name
        user_by_fb.session_token = long_token

    else:
        db.add(User(facebook_id=facebook_id, name=name, session_token=long_token))

    db.commit()

    return RedirectResponse(f"{FRONTEND_URL}/marketing?connected=true")


@app.get("/auth/linkedin/login")
def linkedin_login(user_id: str = None):
    """Start LinkedIn OAuth (OpenID + w_member_social). Pass Supabase user_id as query param."""
    state = user_id or "anonymous"
    q = urlencode(
        {
            "response_type": "code",
            "client_id": LINKEDIN_CLIENT_ID,
            "redirect_uri": LINKEDIN_REDIRECT_URI,
            "state": state,
            "scope": _LINKEDIN_SCOPES,
        }
    )
    return RedirectResponse(f"https://www.linkedin.com/oauth/v2/authorization?{q}")


@app.get("/auth/linkedin/callback")
def linkedin_callback(request: Request, db: Session = Depends(get_db)):
    code = request.query_params.get("code")
    state = request.query_params.get("state", "")

    if not code:
        return RedirectResponse(f"{FRONTEND_URL}/marketing?error=linkedin_denied")

    token_r = requests.post(
        LINKEDIN_TOKEN_URL,
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": LINKEDIN_REDIRECT_URI,
            "client_id": LINKEDIN_CLIENT_ID,
            "client_secret": LINKEDIN_CLIENT_SECRET,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=60,
    )
    tok = token_r.json()
    if "access_token" not in tok:
        return RedirectResponse(f"{FRONTEND_URL}/marketing?error=linkedin_token_failed")

    access = tok["access_token"]
    refresh = tok.get("refresh_token")
    expires_in = tok.get("expires_in")

    from app.linkedin_post import fetch_person_id

    person_id = fetch_person_id(access)

    user_by_uid = None
    if state and state != "anonymous":
        try:
            user_uuid = UUIDType(state)
            user_by_uid = db.query(User).filter(User.user_id == user_uuid).first()
        except ValueError:
            pass

    exp_at = None
    if expires_in:
        exp_at = datetime.now(timezone.utc) + timedelta(seconds=int(expires_in))

    if user_by_uid:
        user_by_uid.linkedin_access_token = access
        if refresh:
            user_by_uid.linkedin_refresh_token = refresh
        user_by_uid.linkedin_token_expires_at = exp_at
        if person_id:
            user_by_uid.linkedin_person_id = person_id
    else:
        db.add(
            User(
                linkedin_access_token=access,
                linkedin_refresh_token=refresh,
                linkedin_token_expires_at=exp_at,
                linkedin_person_id=person_id,
            )
        )

    db.commit()
    return RedirectResponse(f"{FRONTEND_URL}/marketing?connected=linkedin")


@app.get("/user/connection-status")
def get_connection_status(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id_from_token)
):
    """
    Facebook/Instagram: session_token (Meta). LinkedIn: linkedin_access_token.
    Returns per-platform flags and display name.
    """
    try:
        user_uuid = UUIDType(user_id)
    except ValueError:
        return {"error": "Invalid user_id format. Expected UUID."}
    
    user = db.query(User).filter(User.user_id == user_uuid).first()
    
    if not user:
        return {
            "facebook": False,
            "instagram": False,
            "linkedin": False,
            "name": None,
        }

    has_session_token = bool(user.session_token)
    has_linkedin = bool(user.linkedin_access_token)

    return {
        "facebook": has_session_token,
        "instagram": has_session_token,
        "linkedin": has_linkedin,
        "name": user.name,
    }


@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Opsly backend is running"}
