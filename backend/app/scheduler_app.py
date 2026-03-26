"""Background scheduler for LinkedIn (posts — Meta schedules on their side)."""
from __future__ import annotations

import os
from datetime import datetime
from uuid import UUID, uuid4

from apscheduler.schedulers.background import BackgroundScheduler

scheduler = BackgroundScheduler()


def run_linkedin_scheduled_post(
    user_id: str,
    message=None,
    image_bytes=None,
    image_filename=None,
    image_content_type=None,
):
    """APScheduler target: publish a scheduled LinkedIn member post."""
    client_id = os.getenv("LINKEDIN_CLIENT_ID")
    client_secret = os.getenv("LINKEDIN_CLIENT_SECRET")
    if not client_id or not client_secret:
        return

    from app.database import SessionLocal
    from app.linkedin_post import publish_member_post
    from app.models import User

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == UUID(user_id)).first()
        if not user:
            return
        publish_member_post(
            user,
            db,
            client_id,
            client_secret,
            message,
            image_bytes,
            image_filename,
            image_content_type,
        )
    finally:
        db.close()


def start_scheduler() -> None:
    if not scheduler.running:
        scheduler.start()


def shutdown_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)


def schedule_linkedin_post(
    run_at: datetime,
    user_id: str,
    message=None,
    image_bytes=None,
    image_filename=None,
    image_content_type=None,
):
    job_id = f"li_{user_id}_{uuid4().hex[:10]}"
    scheduler.add_job(
        "app.scheduler_app:run_linkedin_scheduled_post",
        "date",
        run_date=run_at,
        kwargs={
            "user_id": user_id,
            "message": message,
            "image_bytes": image_bytes,
            "image_filename": image_filename,
            "image_content_type": image_content_type,
        },
        id=job_id,
        replace_existing=False,
    )
    return job_id
