from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import requests
from uuid import UUID as UUIDType

from app.database import get_db
from app.models import User
from app.auth import get_user_id_from_token

router = APIRouter()


@router.get("/instagram/page-analytics")
def get_instagram_post_analytics(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id_from_token)  # Get from JWT token
):
    # 1. Fetch user from DB by user_id (UUID from auth.users)
    try:
        user_uuid = UUIDType(user_id)
    except ValueError:
        return {"error": "Invalid user_id format. Expected UUID."}
    
    user = db.query(User).filter(User.user_id == user_uuid).first()
    if not user:
        return {"error": "User not found"}

    user_token = user.session_token

    # 2. Get Pages the user manages
    pages_resp = requests.get(
        "https://graph.facebook.com/v24.0/me/accounts",
        params={"access_token": user_token}
    ).json()

    if "data" not in pages_resp or not pages_resp["data"]:
        return {"error": "No Facebook Pages found", "details": pages_resp}

    # Pick first page (or filter here)
    page_info = pages_resp["data"][0]
    page_token = page_info["access_token"]
    page_id = page_info["id"]

    # 3. Get Instagram Business Account linked to Page
    ig_resp = requests.get(
        f"https://graph.facebook.com/v24.0/{page_id}",
        params={
            "fields": "instagram_business_account",
            "access_token": page_token
        }
    ).json()

    if "instagram_business_account" not in ig_resp:
        return {"error": "No Instagram business account linked", "details": ig_resp}

    ig_user_id = ig_resp["instagram_business_account"]["id"]

    # 4. Get Instagram media (posts)
    media_resp = requests.get(
        f"https://graph.facebook.com/v24.0/{ig_user_id}/media",
        params={
            "fields": "id,caption,media_type,media_url,timestamp,permalink",
            "access_token": page_token
        }
    ).json()

    if "data" not in media_resp:
        return {"error": "Failed to fetch Instagram posts", "details": media_resp}

    analytics = []

    for post in media_resp["data"]:
        post_id = post["id"]

        # ----- Basic metrics (likes, comments, saves, shares, reach, impressions) -----
        metrics_resp = requests.get(
            f"https://graph.facebook.com/v24.0/{post_id}/insights",
            params={
                "metric": "likes,comments,shares,saved,reach,impressions",
                "access_token": page_token
            }
        ).json()

        metrics_dict = {}
        if "data" in metrics_resp:
            for m in metrics_resp["data"]:
                metrics_dict[m["name"]] = m.get("values", [{}])[0].get("value", 0)

        # ----- Fetch comments list -----
        comments_resp = requests.get(
            f"https://graph.facebook.com/v24.0/{post_id}/comments",
            params={
                "fields": "id,text,username,timestamp,like_count",
                "access_token": page_token
            }
        ).json()

        comments_list = comments_resp.get("data", [])

        analytics.append({
            "post_id": post_id,
            "caption": post.get("caption"),
            "media_type": post.get("media_type"),
            "media_url": post.get("media_url"),
            "timestamp": post.get("timestamp"),
            "post_url": post.get("permalink"),

            # Stats
            "likes": metrics_dict.get("likes", 0),
            "comments_count": metrics_dict.get("comments", 0),
            "shares": metrics_dict.get("shares", 0),
            "saved": metrics_dict.get("saved", 0),
            "reach": metrics_dict.get("reach", 0),
            "impressions": metrics_dict.get("impressions", 0),

            # Full comment list
            "comments": comments_list
        })

    return {
        "instagram_account": ig_user_id,
        "analytics": analytics
    }
