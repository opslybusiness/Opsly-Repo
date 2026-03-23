from fastapi import FastAPI, Request, Depends
from fastapi.responses import RedirectResponse
import httpx
import os
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.auth import get_user_id_from_token
from datetime import datetime, timedelta
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

app = FastAPI()

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

@app.get("/user/connection-status")
def get_connection_status(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id_from_token)
):
    """
    Check if user has a session_token (Facebook/Instagram connection).
    Returns connection status for both platforms and user name.
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
            "name": None
        }
    
    # If user has session_token, both Facebook and Instagram are considered connected
    has_session_token = bool(user.session_token)
    
    return {
        "facebook": has_session_token,
        "instagram": has_session_token,
        "name": user.name
    }


@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Opsly backend is running"}
