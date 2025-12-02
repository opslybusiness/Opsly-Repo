from fastapi import Depends, APIRouter, UploadFile, File, Form
from sqlalchemy.orm import Session
from datetime import datetime
import requests, time
from uuid import UUID as UUIDType

from app.database import get_db
from app.models import User
from app.auth import get_user_id_from_token

router = APIRouter()

@router.post("/social/post-dynamic")
def post_dynamic(
    post_to_facebook: bool = Form(False),
    post_to_instagram: bool = Form(False),
    message: str = Form(None),
    image: UploadFile = File(None),
    schedule_minutes: int = Form(None),
    scheduled_datetime: str = Form(None),  # "2025-11-26T01:52:53"
    post_now: bool = Form(False),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id_from_token)  # Get from JWT token
):
    # -------------------------
    # 1. Get user by user_id (UUID from auth.users)
    # -------------------------
    try:
        user_uuid = UUIDType(user_id)
    except ValueError:
        return {"error": "Invalid user_id format. Expected UUID."}
    
    user = db.query(User).filter(User.user_id == user_uuid).first()
    if not user:
        return {"error": "User not found"}

    user_token = user.session_token

    # -------------------------
    # 2. Get FB pages managed by user
    # -------------------------
    pages = requests.get(
        "https://graph.facebook.com/v24.0/me/accounts",
        params={"access_token": user_token}
    ).json()

    if "data" not in pages or not pages["data"]:
        return {"error": "No FB pages found", "details": pages}

    page_id = pages["data"][0]["id"]
    page_token = pages["data"][0]["access_token"]

    # -------------------------
    # 3. Get Instagram Business Account (IG User ID)
    # -------------------------
    ig_data = requests.get(
        f"https://graph.facebook.com/v24.0/{page_id}",
        params={"fields": "instagram_business_account", "access_token": page_token}
    ).json()

    ig_user_id = ig_data.get("instagram_business_account", {}).get("id")

    # -------------------------
    # 4. Determine publish time
    # -------------------------
    if post_now:
        scheduled_time = None
        scheduled_dt = "NOW"
    else:
        if scheduled_datetime:
            dt = datetime.strptime(scheduled_datetime, "%Y-%m-%dT%H:%M:%S")
            scheduled_time = int(dt.timestamp())
        elif schedule_minutes is not None:
            scheduled_time = int(time.time()) + schedule_minutes * 60
            dt = datetime.fromtimestamp(scheduled_time)
        else:
            return {"error": "Must choose schedule or post_now"}

        scheduled_dt = dt.strftime("%Y-%m-%d %H:%M:%S")

    # -------------------------
    # 5. Upload image (if provided) — common step
    # -------------------------
    fb_photo_id = None
    ig_image_url = None

    if image:
        # FB upload (unpublished)
        fb_upload = requests.post(
            f"https://graph.facebook.com/v24.0/{page_id}/photos",
            params={"published": "false", "access_token": page_token},
            files={"source": (image.filename, image.file, image.content_type)}
        ).json()

        if "id" not in fb_upload:
            return {"error": "FB image upload failed", "details": fb_upload}

        fb_photo_id = fb_upload["id"]

        # Instagram requires an image URL, the FB upload response gives URL only for some apps
        ig_image_url_resp = requests.get(
            f"https://graph.facebook.com/v24.0/{fb_photo_id}",
            params={"fields": "images", "access_token": page_token}
        ).json()

        if "images" in ig_image_url_resp:
            ig_image_url = ig_image_url_resp["images"][0]["source"]

    results = {}

    # -------------------------
    # 6. Facebook Posting
    # -------------------------
    if post_to_facebook:
        fb_data = {
            "access_token": page_token,
        }

        if post_now:
            fb_data["published"] = True
        else:
            fb_data["published"] = False
            fb_data["scheduled_publish_time"] = scheduled_time

        if message:
            fb_data["message"] = message

        if fb_photo_id:
            fb_data["attached_media[0]"] = f'{{"media_fbid":"{fb_photo_id}"}}'

        fb_post = requests.post(
            f"https://graph.facebook.com/v24.0/{page_id}/feed",
            data=fb_data
        ).json()

        results["facebook"] = fb_post

    # -------------------------
    # 7. Instagram Posting
    # -------------------------
    if post_to_instagram:
        if not ig_user_id:
            results["instagram"] = {"error": "No Instagram Business Account connected"}
        else:
            # Step 1: Create IG Container
            container_payload = {
                "access_token": page_token,
            }

            if message:
                container_payload["caption"] = message

            if ig_image_url:
                container_payload["image_url"] = ig_image_url
            else:
                return {"error": "Instagram requires an image", "note": "IG cannot post text-only"}

            if not post_now:
                container_payload["scheduled_publish_time"] = scheduled_time

            container = requests.post(
                f"https://graph.facebook.com/v24.0/{ig_user_id}/media",
                data=container_payload
            ).json()

            if "id" not in container:
                results["instagram"] = {"error": "IG container creation failed", "details": container}
            else:
                container_id = container["id"]

                # Step 2: Publish the container (only for immediate posting)
                if post_now:
                    publish = requests.post(
                        f"https://graph.facebook.com/v24.0/{ig_user_id}/media_publish",
                        data={"creation_id": container_id, "access_token": page_token}
                    ).json()
                    results["instagram"] = publish
                else:
                    results["instagram"] = container  # scheduled container

    return {
        "status": "success",
        "scheduled_for": scheduled_dt,
        "results": results
    }
