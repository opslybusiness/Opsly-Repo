"""
LinkedIn member UGC posts (Share on LinkedIn + OpenID products).
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING, Any, Optional, Tuple

import requests
from sqlalchemy.orm import Session

if TYPE_CHECKING:
    from app.models import User

LINKEDIN_API = "https://api.linkedin.com"
USERINFO_URL = f"{LINKEDIN_API}/v2/userinfo"
TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"

HEADERS_RESTLI = {
    "X-Restli-Protocol-Version": "2.0.0",
    "LinkedIn-Version": "202411",
}


def _utc_now():
    return datetime.now(timezone.utc)


def _expires_still_valid(expires_at: Optional[datetime], buffer_minutes: int = 5) -> bool:
    """Compare expiry to now without mixing naive/aware datetimes (Postgres timestamptz → aware)."""
    if expires_at is None:
        return False
    exp = expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    else:
        exp = exp.astimezone(timezone.utc)
    return exp > _utc_now() + timedelta(minutes=buffer_minutes)


def _auth_headers(access_token: str) -> dict:
    return {
        "Authorization": f"Bearer {access_token}",
        **HEADERS_RESTLI,
    }


def fetch_person_id(access_token: str) -> Optional[str]:
    r = requests.get(USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"}, timeout=30)
    if not r.ok:
        return None
    return r.json().get("sub")


def refresh_access_token(client_id: str, client_secret: str, refresh_token: str) -> Optional[dict]:
    r = requests.post(
        TOKEN_URL,
        data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": client_id,
            "client_secret": client_secret,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=30,
    )
    if not r.ok:
        return None
    return r.json()


def ensure_fresh_token(user: "User", db: Session, client_id: str, client_secret: str) -> bool:
    if not user.linkedin_access_token:
        return False
    if _expires_still_valid(user.linkedin_token_expires_at):
        return True
    if not user.linkedin_refresh_token:
        return True  # no expiry tracked or no refresh — try access token as-is
    refreshed = refresh_access_token(client_id, client_secret, user.linkedin_refresh_token)
    if not refreshed or "access_token" not in refreshed:
        return False
    user.linkedin_access_token = refreshed["access_token"]
    if refreshed.get("refresh_token"):
        user.linkedin_refresh_token = refreshed["refresh_token"]
    exp = refreshed.get("expires_in")
    if exp:
        user.linkedin_token_expires_at = _utc_now() + timedelta(seconds=int(exp))
    db.commit()
    return True


def register_image_upload(
    access_token: str, person_id: str, image_bytes: bytes, content_type: str
) -> Tuple[Optional[str], Optional[dict]]:
    owner = f"urn:li:person:{person_id}"
    reg_url = f"{LINKEDIN_API}/v2/assets?action=registerUpload"
    body = {
        "registerUploadRequest": {
            "owner": owner,
            "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
            "serviceRelationships": [
                {"identifier": "urn:li:userGeneratedContent", "relationshipType": "OWNER"}
            ],
        }
    }
    r = requests.post(
        reg_url,
        headers={**_auth_headers(access_token), "Content-Type": "application/json"},
        data=json.dumps(body),
        timeout=60,
    )
    if not r.ok:
        return None, r.json() if r.text else {"status": r.status_code}

    payload = r.json()
    data = payload.get("value") or {}
    asset = data.get("asset")
    um = data.get("uploadMechanism") or {}
    upload = um.get("com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest") or {}
    upload_url = upload.get("uploadUrl")
    if not asset or not upload_url:
        return None, {"error": "Unexpected registerUpload response", "payload_keys": list(payload.keys())}
    upload_headers = upload.get("headers") or {}
    flat_headers = {}
    for k, vals in upload_headers.items():
        flat_headers[k] = vals[0] if isinstance(vals, list) else vals

    put = requests.put(
        upload_url,
        data=image_bytes,
        headers={**flat_headers, "Content-Type": content_type or "application/octet-stream"},
        timeout=120,
    )
    if not put.ok:
        return None, {"step": "binary_upload", "status": put.status_code, "text": put.text[:500]}
    return asset, None


def build_ugc_body(author_urn: str, message: Optional[str], asset_urn: Optional[str]) -> dict:
    share: dict[str, Any] = {
        "shareCommentary": {"text": (message or "").strip() or " "},
        "shareMediaCategory": "NONE",
    }
    if asset_urn:
        share["shareMediaCategory"] = "IMAGE"
        share["media"] = [{"status": "READY", "media": asset_urn}]

    return {
        "author": author_urn,
        "lifecycleState": "PUBLISHED",
        "specificContent": {"com.linkedin.ugc.ShareContent": share},
        "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
    }


def publish_member_post(
    user: "User",
    db: Session,
    client_id: str,
    client_secret: str,
    message: Optional[str],
    image_bytes: Optional[bytes],
    image_filename: Optional[str],
    image_content_type: Optional[str],
) -> dict:
    if not user.linkedin_access_token:
        return {"error": "LinkedIn not connected"}
    if not client_id or not client_secret:
        return {"error": "LinkedIn API credentials missing on server"}

    ensure_fresh_token(user, db, client_id, client_secret)
    db.refresh(user)

    pid = user.linkedin_person_id or fetch_person_id(user.linkedin_access_token)
    if not pid:
        return {"error": "Could not resolve LinkedIn member id (userinfo)"}
    if not user.linkedin_person_id:
        user.linkedin_person_id = pid
        db.commit()

    if not ((message and message.strip()) or image_bytes):
        return {"error": "LinkedIn post requires a caption and/or image"}

    token = user.linkedin_access_token
    author_urn = f"urn:li:person:{pid}"
    asset_urn = None

    if image_bytes:
        asset_urn, err = register_image_upload(token, pid, image_bytes, image_content_type or "image/jpeg")
        if err:
            return {"error": "LinkedIn image upload failed", "details": err}

    body = build_ugc_body(author_urn, message, asset_urn)
    r = requests.post(
        f"{LINKEDIN_API}/v2/ugcPosts",
        headers={**_auth_headers(token), "Content-Type": "application/json"},
        data=json.dumps(body),
        timeout=60,
    )

    if r.status_code not in (200, 201):
        try:
            detail = r.json()
        except Exception:
            detail = {"text": r.text[:800]}
        return {"error": "LinkedIn publish failed", "status": r.status_code, "details": detail}

    try:
        return r.json()
    except Exception:
        return {"ok": True, "raw": r.text[:500]}
