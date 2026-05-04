from datetime import datetime, timedelta, timezone, time
from typing import List, Optional
from uuid import UUID as UUIDType
import uuid
import os
from zoneinfo import ZoneInfo

import requests
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.orm import Session

from app.auth import get_user_id_from_token
from app.database import get_db
from app.models import User

router = APIRouter(prefix="/meetings", tags=["meeting-scheduling"])

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_CALENDAR_INSERT_EVENT_URL = (
    "https://www.googleapis.com/calendar/v3/calendars/primary/events"
)
GOOGLE_CALENDAR_LIST_EVENTS_URL = (
    "https://www.googleapis.com/calendar/v3/calendars/primary/events"
)
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")


class CreateGoogleMeetingRequest(BaseModel):
    summary: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = ""
    start: str = Field(..., description="RFC3339 datetime string")
    end: str = Field(..., description="RFC3339 datetime string")
    attendees: List[str] = []
    timezone: str = "UTC"


class SlotQueryResponse(BaseModel):
    start: str
    end: str
    status: str


class CalendarEventResponse(BaseModel):
    id: str
    summary: str
    description: Optional[str] = ""
    start: str
    end: str
    status: str
    html_link: Optional[str] = None
    meet_link: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


def _refresh_google_access_token(user: User, db: Session) -> None:
    if not user.google_refresh_token:
        raise HTTPException(
            status_code=400,
            detail="Google refresh token missing. Reconnect Google with consent.",
        )

    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth is not configured.")

    resp = requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "refresh_token": user.google_refresh_token,
            "grant_type": "refresh_token",
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=60,
    )
    data = resp.json()
    new_access = data.get("access_token")
    if not new_access:
        raise HTTPException(status_code=401, detail="Failed to refresh Google access token.")

    user.google_access_token = new_access
    expires_in = int(data.get("expires_in", 3600))
    user.google_token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    db.add(user)
    db.commit()
    db.refresh(user)


def _get_user_from_token(user_id: str, db: Session) -> User:
    try:
        user_uuid = UUIDType(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format. Expected UUID.")

    user = db.query(User).filter(User.user_id == user_uuid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if not user.google_access_token:
        raise HTTPException(status_code=400, detail="Google is not connected for this user.")
    return user


def _ensure_fresh_google_access_token(user: User, db: Session) -> str:
    now_utc = datetime.now(timezone.utc)
    if user.google_token_expires_at and user.google_token_expires_at <= (now_utc + timedelta(seconds=60)):
        _refresh_google_access_token(user, db)
    return user.google_access_token


def _extract_meet_link(event: dict) -> Optional[str]:
    conference_data = event.get("conferenceData", {})
    for ep in conference_data.get("entryPoints", []):
        if ep.get("entryPointType") == "video":
            return ep.get("uri")
    return event.get("hangoutLink")


def _google_list_events(access_token: str, start_iso: str, end_iso: str, timezone_name: str):
    return requests.get(
        GOOGLE_CALENDAR_LIST_EVENTS_URL,
        params={
            "timeMin": start_iso,
            "timeMax": end_iso,
            "singleEvents": "true",
            "orderBy": "startTime",
            "maxResults": 2500,
            "timeZone": timezone_name,
        },
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=60,
    )


@router.post("/google")
def create_google_meeting(
    body: CreateGoogleMeetingRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id_from_token),
):
    user = _get_user_from_token(user_id, db)
    _ensure_fresh_google_access_token(user, db)

    attendees_payload = [{"email": email.strip()} for email in body.attendees if email and email.strip()]
    event_payload = {
        "summary": body.summary,
        "description": body.description or "",
        "start": {"dateTime": body.start, "timeZone": body.timezone},
        "end": {"dateTime": body.end, "timeZone": body.timezone},
        "attendees": attendees_payload,
        "conferenceData": {
            "createRequest": {
                "requestId": str(uuid.uuid4()),
                "conferenceSolutionKey": {"type": "hangoutsMeet"},
            }
        },
    }

    def _insert_event(access_token: str):
        return requests.post(
            GOOGLE_CALENDAR_INSERT_EVENT_URL,
            params={"conferenceDataVersion": 1, "sendUpdates": "all"},
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            json=event_payload,
            timeout=60,
        )

    insert_resp = _insert_event(user.google_access_token)

    if insert_resp.status_code == 401:
        _refresh_google_access_token(user, db)
        insert_resp = _insert_event(user.google_access_token)

    if insert_resp.status_code not in (200, 201):
        raise HTTPException(
            status_code=insert_resp.status_code,
            detail=f"Failed to create Google meeting: {insert_resp.text}",
        )

    created = insert_resp.json()
    meet_link = None
    conference_data = created.get("conferenceData", {})
    for ep in conference_data.get("entryPoints", []):
        if ep.get("entryPointType") == "video":
            meet_link = ep.get("uri")
            break
    if not meet_link:
        meet_link = created.get("hangoutLink")

    return {
        "status": "success",
        "eventId": created.get("id"),
        "eventLink": created.get("htmlLink"),
        "meetLink": meet_link,
        "startsAt": body.start,
        "endsAt": body.end,
    }


@router.get("/google/events")
def list_google_calendar_events(
    start: str = Query(..., description="RFC3339 start datetime"),
    end: str = Query(..., description="RFC3339 end datetime"),
    timezone_name: str = Query("UTC", alias="timezone"),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id_from_token),
):
    user = _get_user_from_token(user_id, db)
    access_token = _ensure_fresh_google_access_token(user, db)

    response = _google_list_events(access_token, start, end, timezone_name)
    if response.status_code == 401:
        _refresh_google_access_token(user, db)
        response = _google_list_events(user.google_access_token, start, end, timezone_name)

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail=f"Failed to fetch Google Calendar events: {response.text}",
        )

    items = response.json().get("items", [])
    events = []
    for item in items:
        start_raw = item.get("start", {}).get("dateTime") or item.get("start", {}).get("date")
        end_raw = item.get("end", {}).get("dateTime") or item.get("end", {}).get("date")
        if not start_raw or not end_raw:
            continue
        events.append(
            CalendarEventResponse(
                id=item.get("id", ""),
                summary=item.get("summary") or "Busy",
                description=item.get("description", ""),
                start=start_raw,
                end=end_raw,
                status=item.get("status", "confirmed"),
                html_link=item.get("htmlLink"),
                meet_link=_extract_meet_link(item),
            ).model_dump()
        )

    return {"events": events}


@router.get("/google/slots")
def list_google_day_slots(
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    timezone_name: str = Query("UTC", alias="timezone"),
    slot_minutes: int = Query(30, ge=15, le=120),
    workday_start_hour: int = Query(9, ge=0, le=23),
    workday_end_hour: int = Query(18, ge=1, le=24),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id_from_token),
):
    if workday_end_hour <= workday_start_hour:
        raise HTTPException(status_code=400, detail="workday_end_hour must be greater than start hour.")

    user = _get_user_from_token(user_id, db)
    access_token = _ensure_fresh_google_access_token(user, db)

    try:
        day = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    try:
        tz = ZoneInfo(timezone_name)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid timezone.")

    day_start = datetime.combine(day, time.min).replace(tzinfo=tz)
    day_end = day_start + timedelta(days=1)
    start_iso = day_start.isoformat()
    end_iso = day_end.isoformat()

    response = _google_list_events(access_token, start_iso, end_iso, timezone_name)
    if response.status_code == 401:
        _refresh_google_access_token(user, db)
        response = _google_list_events(user.google_access_token, start_iso, end_iso, timezone_name)

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail=f"Failed to fetch Google Calendar slots: {response.text}",
        )

    busy_ranges = []
    for item in response.json().get("items", []):
        start_raw = item.get("start", {}).get("dateTime")
        end_raw = item.get("end", {}).get("dateTime")
        if not start_raw or not end_raw:
            continue
        try:
            busy_start = datetime.fromisoformat(start_raw.replace("Z", "+00:00"))
            busy_end = datetime.fromisoformat(end_raw.replace("Z", "+00:00"))
            busy_ranges.append((busy_start, busy_end))
        except ValueError:
            continue

    work_start = datetime.combine(day, time(hour=workday_start_hour)).replace(tzinfo=tz)
    work_end = datetime.combine(day, time(hour=0)).replace(tzinfo=tz) + timedelta(hours=workday_end_hour)

    slots = []
    cursor = work_start
    slot_delta = timedelta(minutes=slot_minutes)
    while cursor + slot_delta <= work_end:
        slot_start = cursor
        slot_end = cursor + slot_delta
        is_busy = any(slot_start < busy_end and slot_end > busy_start for busy_start, busy_end in busy_ranges)
        slots.append(
            SlotQueryResponse(
                start=slot_start.isoformat(),
                end=slot_end.isoformat(),
                status="scheduled" if is_busy else "available",
            ).model_dump()
        )
        cursor = slot_end

    return {"date": date, "slots": slots}
