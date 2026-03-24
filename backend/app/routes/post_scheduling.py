from __future__ import annotations

import os
from datetime import datetime
from io import BytesIO
from uuid import UUID as UUIDType

import requests
import time
from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.auth import get_user_id_from_token
from app.database import get_db
from app.linkedin_post import publish_member_post
from app.models import User
from app.scheduler_app import schedule_linkedin_post

router = APIRouter()


@router.post("/social/post-dynamic")
def post_dynamic(
    post_to_facebook: bool = Form(False),
    post_to_instagram: bool = Form(False),
    post_to_linkedin: bool = Form(False),
    message: str = Form(None),
    image: UploadFile = File(None),
    schedule_minutes: int = Form(None),
    scheduled_datetime: str = Form(None),
    post_now: bool = Form(False),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id_from_token),
):
    try:
        user_uuid = UUIDType(user_id)
    except ValueError:
        return {"error": "Invalid user_id format. Expected UUID."}

    user = db.query(User).filter(User.user_id == user_uuid).first()
    if not user:
        return {"error": "User not found"}

    if not (post_to_facebook or post_to_instagram or post_to_linkedin):
        return {"error": "Select at least one platform"}

    image_bytes = None
    image_filename = None
    image_content_type = None
    if image:
        image_bytes = image.file.read()
        image_filename = image.filename or "upload"
        image_content_type = image.content_type or "application/octet-stream"

    if post_to_instagram and not image_bytes:
        return {"error": "Instagram requires an image", "note": "IG cannot post text-only"}

    # --- publish / schedule time (Facebook uses unix; LinkedIn uses run_at datetime) ---
    if post_now:
        scheduled_time = None
        scheduled_dt = "NOW"
        run_at_dt = None
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
        run_at_dt = dt

    # --- Facebook + Instagram prerequisites ---
    page_id = None
    page_token = None
    ig_user_id = None
    fb_photo_id = None
    ig_image_url = None

    if post_to_facebook or post_to_instagram:
        user_token = user.session_token
        if not user_token:
            return {"error": "Connect Facebook to post to Facebook or Instagram."}

        pages = requests.get(
            "https://graph.facebook.com/v24.0/me/accounts",
            params={"access_token": user_token},
            timeout=60,
        ).json()

        if "data" not in pages or not pages["data"]:
            return {"error": "No FB pages found", "details": pages}

        page_id = pages["data"][0]["id"]
        page_token = pages["data"][0]["access_token"]

        ig_data = requests.get(
            f"https://graph.facebook.com/v24.0/{page_id}",
            params={"fields": "instagram_business_account", "access_token": page_token},
            timeout=60,
        ).json()
        ig_user_id = ig_data.get("instagram_business_account", {}).get("id")

        if image_bytes:
            fb_upload = requests.post(
                f"https://graph.facebook.com/v24.0/{page_id}/photos",
                params={"published": "false", "access_token": page_token},
                files={"source": (image_filename, BytesIO(image_bytes), image_content_type)},
                timeout=120,
            ).json()

            if "id" not in fb_upload:
                return {"error": "FB image upload failed", "details": fb_upload}

            fb_photo_id = fb_upload["id"]

            ig_image_url_resp = requests.get(
                f"https://graph.facebook.com/v24.0/{fb_photo_id}",
                params={"fields": "images", "access_token": page_token},
                timeout=60,
            ).json()

            if "images" in ig_image_url_resp:
                ig_image_url = ig_image_url_resp["images"][0]["source"]

    results = {}

    # --- Facebook ---
    if post_to_facebook:
        fb_data = {"access_token": page_token}
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
            data=fb_data,
            timeout=60,
        ).json()
        results["facebook"] = fb_post

    # --- Instagram ---
    if post_to_instagram:
        if not ig_user_id:
            results["instagram"] = {"error": "No Instagram Business Account connected"}
        else:
            container_payload = {"access_token": page_token}
            if message:
                container_payload["caption"] = message
            if ig_image_url:
                container_payload["image_url"] = ig_image_url
            else:
                return {"error": "Instagram requires an image", "note": "IG cannot post text-only"}

            container = requests.post(
                f"https://graph.facebook.com/v24.0/{ig_user_id}/media",
                data=container_payload,
                timeout=60,
            ).json()

            if "id" not in container:
                results["instagram"] = {"error": "IG container creation failed", "details": container}
            else:
                container_id = container["id"]
                publish_payload = {"creation_id": container_id, "access_token": page_token}
                if not post_now:
                    publish_payload["scheduled_publish_time"] = scheduled_time

                publish = requests.post(
                    f"https://graph.facebook.com/v24.0/{ig_user_id}/media_publish",
                    data=publish_payload,
                    timeout=60,
                ).json()
                results["instagram"] = publish

    # --- LinkedIn (member) — immediate or in-process scheduler ---
    if post_to_linkedin:
        if not user.linkedin_access_token:
            return {"error": "Connect LinkedIn to post there."}

        li_client = os.getenv("LINKEDIN_CLIENT_ID")
        li_secret = os.getenv("LINKEDIN_CLIENT_SECRET")
        if not li_client or not li_secret:
            return {"error": "LinkedIn is not configured on the server (set LINKEDIN_CLIENT_ID / SECRET)."}

        if post_now:
            results["linkedin"] = publish_member_post(
                user,
                db,
                li_client,
                li_secret,
                message,
                image_bytes,
                image_filename,
                image_content_type,
            )
        else:
            if not run_at_dt:
                return {"error": "Invalid schedule time for LinkedIn"}
            job_id = schedule_linkedin_post(
                run_at_dt,
                str(user_uuid),
                message,
                image_bytes,
                image_filename,
                image_content_type,
            )
            results["linkedin"] = {
                "scheduled": True,
                "job_id": job_id,
                "run_at": scheduled_dt,
                "note": "LinkedIn uses server-side scheduling (APScheduler); keep this process running until the post goes out.",
            }

    return {
        "status": "success",
        "scheduled_for": scheduled_dt,
        "results": results,
    }
