from fastapi import APIRouter, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from sqlalchemy import text
from uuid import UUID as UUIDType
from typing import Optional, Union, List
from pydantic import BaseModel
from datetime import datetime
import logging
import json
import os
import requests
from requests.exceptions import ReadTimeout, ConnectionError as RequestsConnectionError

# Note: sqlalchemy.text is still used by bookMeeting (voice_bot_meetings table)

logger = logging.getLogger(__name__)

from app.database import get_db
from app.models import User
from app.auth import get_user_id_from_token


router = APIRouter(prefix="/voice-bot", tags=["voice-bots"])

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

VAPI_API_KEY      = os.getenv("VAPI_API_KEY")
VAPI_BASE_URL     = os.getenv("VAPI_BASE_URL", "https://api.vapi.ai")
BACKEND_PUBLIC_URL   = os.getenv("BACKEND_PUBLIC_URL", "http://localhost:8000")
# Chatbot backend — handles embeddings and pgvector retrieval (no Jina key needed here)
CHATBOT_BACKEND_URL  = os.getenv("CHATBOT_BACKEND_URL", "https://chatbot-be-three.vercel.app")
CHATBOT_INTERNAL_KEY = os.getenv("CHATBOT_INTERNAL_KEY", "")

DEFAULT_SYSTEM_PROMPT = (
    "You are a helpful AI voice assistant for this business. "
    "Always use the queryDocs tool to search the knowledge base before answering factual questions. "
    "Use getDate when the caller asks about today's date. "
    "Use bookMeeting to schedule appointments when a caller wants to book a meeting. "
    "Be concise, friendly, and professional. "
    "If the knowledge base has no relevant information, say so honestly and offer to connect the caller with a human."
)

TOOL_NAMES = ("queryDocs", "getDate", "bookMeeting")


# ---------------------------------------------------------------------------
# Pydantic models for Vapi tool-call webhook requests
# ---------------------------------------------------------------------------

class _ToolCallFunction(BaseModel):
    name: str
    arguments: Union[str, dict] = {}


class _VapiToolCall(BaseModel):
    id: str
    type: str = "function"
    function: _ToolCallFunction


class _VapiCall(BaseModel):
    id: Optional[str] = None
    assistantId: Optional[str] = None


class _VapiToolMessage(BaseModel):
    type: str = "tool-calls"
    call: Optional[_VapiCall] = None
    toolCalls: List[_VapiToolCall] = []


class VapiToolRequest(BaseModel):
    message: _VapiToolMessage


# ---------------------------------------------------------------------------
# Vapi API helpers
# ---------------------------------------------------------------------------

def _vapi_headers() -> dict:
    if not VAPI_API_KEY:
        raise HTTPException(status_code=500, detail="VAPI_API_KEY is not configured.")
    return {"Authorization": f"Bearer {VAPI_API_KEY}", "Content-Type": "application/json"}


def _vapi_request(method: str, url: str, timeout: int = 30, **kwargs):
    try:
        return requests.request(method, url, timeout=timeout, **kwargs)
    except ReadTimeout:
        raise HTTPException(status_code=504, detail=f"Vapi API timed out after {timeout}s.")
    except RequestsConnectionError:
        raise HTTPException(status_code=502, detail="Could not reach the Vapi API.")


# ---------------------------------------------------------------------------
# Tool definitions — inline inside model.tools (Vapi's supported format)
# ---------------------------------------------------------------------------

def _model_tools() -> List[dict]:
    """
    Return the 3 tool definitions to embed inside the assistant's model.tools array.
    Tools use server.url webhooks; the user is identified at runtime from assistantId.
    """
    base = f"{BACKEND_PUBLIC_URL}/voice-bot/tools"
    return [
        {
            "type": "function",
            "function": {
                "name": "queryDocs",
                "description": (
                    "Search this business's knowledge base (uploaded documents, FAQs, policies) "
                    "to answer customer questions. Always call before answering factual questions."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The customer's question or topic to look up.",
                        }
                    },
                    "required": ["query"],
                },
            },
            "server": {"url": f"{base}/query-docs"},
        },
        {
            "type": "function",
            "function": {
                "name": "getDate",
                "description": "Return today's date. Use when the caller asks what day or date it is.",
                "parameters": {"type": "object", "properties": {}},
            },
            "server": {"url": f"{base}/get-date"},
        },
        {
            "type": "function",
            "function": {
                "name": "bookMeeting",
                "description": (
                    "Book a meeting or appointment for the caller. "
                    "Collect name, email, preferred date/time and any notes first."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "name":  {"type": "string", "description": "Caller's full name."},
                        "email": {"type": "string", "description": "Caller's email address."},
                        "date":  {"type": "string", "description": "Preferred date/time (YYYY-MM-DD HH:MM)."},
                        "notes": {"type": "string", "description": "Any additional notes or questions."},
                    },
                    "required": ["name", "email", "date"],
                },
            },
            "server": {"url": f"{base}/book-meeting"},
        },
    ]


# ---------------------------------------------------------------------------
# RAG helper — delegates to the chatbot backend's /internal/retrieve endpoint
# (embedding + pgvector search runs there, no Jina key needed here)
# ---------------------------------------------------------------------------

def _retrieve_docs(query: str, user_id: str, top_k: int = 3) -> str:
    """
    Call the chatbot backend's server-to-server /internal/retrieve endpoint.
    Returns the top-k relevant document chunks as a single string.
    """
    try:
        resp = requests.post(
            f"{CHATBOT_BACKEND_URL}/internal/retrieve",
            headers={
                "Content-Type": "application/json",
                "x-internal-key": CHATBOT_INTERNAL_KEY,
            },
            json={"query": query, "user_id": user_id, "top_k": top_k},
            timeout=15,
        )
    except ReadTimeout:
        logger.warning("Chatbot backend timed out during retrieval")
        return "I'm having trouble accessing the knowledge base right now."
    except RequestsConnectionError:
        logger.warning("Could not reach chatbot backend")
        return "I'm having trouble accessing the knowledge base right now."

    if resp.status_code != 200:
        logger.error("Chatbot /internal/retrieve returned %s: %s", resp.status_code, resp.text[:200])
        return "I'm having trouble searching the knowledge base right now."

    data = resp.json()
    context = data.get("context", "")
    return context if context else "No relevant information was found in this business's knowledge base."


# ---------------------------------------------------------------------------
# User helpers
# ---------------------------------------------------------------------------

def get_current_user(db: Session, user_id_str: str) -> User:
    try:
        user_uuid = UUIDType(user_id_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format.")

    user = db.query(User).filter(User.user_id == user_uuid).first()
    if not user:
        user = User(user_id=user_uuid, facebook_id=None, name=None, session_token=None)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def _user_by_assistant(db: Session, assistant_id: str) -> User:
    """Look up the user who owns this Vapi assistant (used inside tool webhooks)."""
    user = db.query(User).filter(User.vapi_assistant_id == assistant_id).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail=f"No user found for assistant '{assistant_id}'.",
        )
    return user


# ---------------------------------------------------------------------------
# Assistant payload builder
# ---------------------------------------------------------------------------

def _build_assistant_payload(business_name: str, system_prompt: str) -> dict:
    """Build the full Vapi assistant creation payload with tools in model.tools."""
    return {
        "name": business_name,
        "model": {
            "provider": "openai",
            "model": "gpt-4o-mini",
            "messages": [{"role": "system", "content": system_prompt}],
            "fallbackModels": [{"provider": "openai", "model": "gpt-4o"}],
            "tools": _model_tools(),
        },
        "transcriber": {
            "provider": "deepgram",
            "model": "nova-2",
            "language": "en",
            "fallbackPlan": {
                "transcribers": [
                    {"provider": "gladia"},
                    {"provider": "talkscriber", "model": "whisper"},
                ],
            },
        },
        "voice": {
            "provider": "openai",
            "voiceId": "alloy",
            "fallbackPlan": {
                "voices": [{"provider": "playht", "voiceId": "jennifer"}],
            },
        },
        "firstMessage": f"Hello! Thank you for calling {business_name}. How can I help you today?",
        "endCallMessage": "Thank you for calling. Have a great day! Goodbye.",
    }


# ===========================================================================
# TOOL WEBHOOK ENDPOINTS  (called by Vapi — no JWT auth, user ID from assistantId)
# ===========================================================================

@router.post("/tools/query-docs")
def tool_query_docs(body: VapiToolRequest, db: Session = Depends(get_db)):
    """
    Vapi calls this endpoint when the assistant invokes the 'queryDocs' tool.
    Identifies the user via the assistantId in the request, then delegates
    retrieval to the chatbot backend (embedding + pgvector search runs there).
    """
    assistant_id = body.message.call.assistantId if body.message.call else None
    if not assistant_id:
        raise HTTPException(status_code=400, detail="Missing assistantId in tool call.")

    user = _user_by_assistant(db, assistant_id)
    user_id = str(user.user_id)

    results = []
    for tc in body.message.toolCalls:
        if tc.function.name != "queryDocs":
            continue
        args = tc.function.arguments
        if isinstance(args, str):
            args = json.loads(args)
        query = args.get("query", "")
        answer = _retrieve_docs(query, user_id) if query else "No query provided."
        results.append({"toolCallId": tc.id, "result": answer})

    if not results:
        raise HTTPException(status_code=400, detail="No queryDocs call in request.")
    return {"results": results}


@router.post("/tools/get-date")
def tool_get_date(body: VapiToolRequest):
    """Vapi calls this when the assistant invokes the 'getDate' tool."""
    results = []
    for tc in body.message.toolCalls:
        if tc.function.name != "getDate":
            continue
        today = datetime.utcnow().strftime("%A, %B %d, %Y")
        results.append({"toolCallId": tc.id, "result": f"Today is {today} (UTC)."})

    if not results:
        raise HTTPException(status_code=400, detail="No getDate call in request.")
    return {"results": results}


@router.post("/tools/book-meeting")
def tool_book_meeting(body: VapiToolRequest, db: Session = Depends(get_db)):
    """
    Vapi calls this when the assistant invokes the 'bookMeeting' tool.
    Saves the booking to the voice_bot_meetings table and confirms to the caller.
    """
    # Ensure meetings table exists
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS voice_bot_meetings (
            id           SERIAL PRIMARY KEY,
            user_id      TEXT NOT NULL,
            name         TEXT NOT NULL,
            email        TEXT NOT NULL,
            meeting_date TEXT NOT NULL,
            notes        TEXT,
            created_at   TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    db.commit()

    assistant_id = body.message.call.assistantId if body.message.call else None
    user_id = ""
    if assistant_id:
        try:
            user = _user_by_assistant(db, assistant_id)
            user_id = str(user.user_id)
        except HTTPException:
            pass

    results = []
    for tc in body.message.toolCalls:
        if tc.function.name != "bookMeeting":
            continue
        args = tc.function.arguments
        if isinstance(args, str):
            args = json.loads(args)

        name  = args.get("name", "")
        email = args.get("email", "")
        date  = args.get("date", "")
        notes = args.get("notes", "")

        if not (name and email and date):
            results.append({
                "toolCallId": tc.id,
                "result": "I need your full name, email address, and preferred date/time to complete the booking.",
            })
            continue

        try:
            db.execute(text("""
                INSERT INTO voice_bot_meetings (user_id, name, email, meeting_date, notes)
                VALUES (:uid, :name, :email, :date, :notes)
            """), {"uid": user_id, "name": name, "email": email, "date": date, "notes": notes})
            db.commit()
            confirmation = (
                f"Your meeting has been booked for {date}. "
                f"A confirmation will be sent to {email}. "
                "Is there anything else I can help you with?"
            )
        except Exception as exc:
            logger.error("Failed to save meeting: %s", exc)
            confirmation = (
                f"I've noted your meeting request for {date}. "
                f"Our team will follow up at {email} to confirm. "
                "Is there anything else I can help you with?"
            )

        results.append({"toolCallId": tc.id, "result": confirmation})

    if not results:
        raise HTTPException(status_code=400, detail="No bookMeeting call in request.")
    return {"results": results}


# ===========================================================================
# ASSISTANT MANAGEMENT  (requires JWT)
# ===========================================================================

@router.post("/assistant")
def create_assistant(
    business_name: str = Form("My Business"),
    system_prompt: str = Form(DEFAULT_SYSTEM_PROMPT),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id_from_token),
):
    """
    Create a Vapi assistant for the authenticated user.
    Automatically provisions the queryDocs / getDate / bookMeeting tools.
    """
    user = get_current_user(db, user_id)

    payload = _build_assistant_payload(business_name, system_prompt)
    resp = _vapi_request("POST", f"{VAPI_BASE_URL}/assistant",
                         headers=_vapi_headers(), json=payload, timeout=30)

    if resp.status_code not in (200, 201):
        raise HTTPException(
            status_code=resp.status_code,
            detail=f"Failed to create Vapi assistant: {resp.text}",
        )

    assistant = resp.json()
    assistant_id = assistant.get("id")
    if not assistant_id:
        raise HTTPException(status_code=500, detail="Vapi did not return an assistant ID.")

    user.vapi_assistant_id = assistant_id
    user.vapi_system_prompt = system_prompt
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "vapi_assistant_id": assistant_id,
        "business_name": business_name,
        "system_prompt": user.vapi_system_prompt,
        "tools_configured": list(TOOL_NAMES),
        "vapi_response": assistant,
    }


@router.get("/assistant")
def get_assistant(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id_from_token),
):
    user = get_current_user(db, user_id)

    if not user.vapi_assistant_id:
        raise HTTPException(
            status_code=404,
            detail="No Vapi assistant found. Create one via POST /voice-bot/assistant.",
        )

    resp = _vapi_request("GET", f"{VAPI_BASE_URL}/assistant/{user.vapi_assistant_id}",
                         headers=_vapi_headers())
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code,
                            detail=f"Failed to fetch assistant: {resp.text}")

    return {
        "vapi_assistant_id": user.vapi_assistant_id,
        "system_prompt": user.vapi_system_prompt or DEFAULT_SYSTEM_PROMPT,
        "vapi_details": resp.json(),
    }


@router.patch("/assistant")
def update_assistant(
    business_name: Optional[str] = Form(None),
    system_prompt: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id_from_token),
):
    user = get_current_user(db, user_id)

    if not user.vapi_assistant_id:
        raise HTTPException(status_code=404, detail="No Vapi assistant found.")

    patch_payload: dict = {}

    if system_prompt is not None:
        current_resp = _vapi_request("GET", f"{VAPI_BASE_URL}/assistant/{user.vapi_assistant_id}",
                                     headers=_vapi_headers())
        if current_resp.status_code != 200:
            raise HTTPException(status_code=current_resp.status_code,
                                detail=f"Failed to fetch assistant: {current_resp.text}")
        existing_model = current_resp.json().get("model", {})
        existing_messages = existing_model.get("messages", [])
        new_messages = [m for m in existing_messages if m.get("role") != "system"]
        new_messages.insert(0, {"role": "system", "content": system_prompt})
        # Also refresh tool definitions in case BACKEND_PUBLIC_URL changed
        patch_payload["model"] = {**existing_model, "messages": new_messages, "tools": _model_tools()}

    if business_name is not None:
        patch_payload["name"] = business_name
        patch_payload["firstMessage"] = (
            f"Hello! Thank you for calling {business_name}. How can I help you today?"
        )

    resp = _vapi_request("PATCH", f"{VAPI_BASE_URL}/assistant/{user.vapi_assistant_id}",
                         headers=_vapi_headers(), json=patch_payload)
    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=resp.status_code,
                            detail=f"Failed to update assistant: {resp.text}")

    if system_prompt is not None:
        user.vapi_system_prompt = system_prompt
        db.add(user)
        db.commit()
        db.refresh(user)

    return {
        "vapi_assistant_id": user.vapi_assistant_id,
        "system_prompt": user.vapi_system_prompt,
        "vapi_response": resp.json(),
    }


# ===========================================================================
# PHONE NUMBER
# ===========================================================================

@router.post("/buy-number")
def buy_number(
    area_code: str = Form("412"),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id_from_token),
):
    user = get_current_user(db, user_id)

    if not user.vapi_assistant_id:
        raise HTTPException(status_code=400,
                            detail="Create your assistant first via POST /voice-bot/assistant.")

    list_resp = _vapi_request("GET", f"{VAPI_BASE_URL}/phone-number", headers=_vapi_headers())
    existing = list_resp.json() if list_resp.status_code == 200 else []

    if existing:
        phone_data = existing[0]
    else:
        create_resp = _vapi_request("POST", f"{VAPI_BASE_URL}/phone-number",
                                    headers=_vapi_headers(), json={"provider": "vapi"})
        if create_resp.status_code not in (200, 201):
            raise HTTPException(status_code=create_resp.status_code,
                                detail=f"Failed to provision number: {create_resp.text}")
        phone_data = create_resp.json()

    number_value = phone_data.get("number")
    external_id  = phone_data.get("id")
    if not number_value:
        raise HTTPException(status_code=500, detail="Vapi did not return a phone number.")

    patch_resp = _vapi_request("PATCH", f"{VAPI_BASE_URL}/phone-number/{external_id}",
                               headers=_vapi_headers(),
                               json={"assistantId": user.vapi_assistant_id})
    if patch_resp.status_code not in (200, 201):
        raise HTTPException(status_code=patch_resp.status_code,
                            detail=f"Failed to link assistant to number: {patch_resp.text}")

    user.voice_bot_number = number_value
    user.voice_bot_provider_sid = external_id
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "voice_bot_number": user.voice_bot_number,
        "voice_bot_provider_sid": user.voice_bot_provider_sid,
        "assistant_id_used": user.vapi_assistant_id,
        "vapi_response": patch_resp.json(),
    }


@router.get("/my-number")
def get_my_number(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id_from_token),
):
    user = get_current_user(db, user_id)
    if not user.voice_bot_number:
        raise HTTPException(status_code=404, detail="No voice bot number configured.")
    return {"voice_bot_number": user.voice_bot_number, "vapi_assistant_id": user.vapi_assistant_id}


# ===========================================================================
# RECORDINGS
# ===========================================================================

@router.get("/recordings")
def get_recordings(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id_from_token),
):
    user = get_current_user(db, user_id)
    if not user.voice_bot_number:
        raise HTTPException(status_code=400, detail="No voice bot number configured.")

    params = {}
    if user.voice_bot_provider_sid:
        params["phoneNumberId"] = user.voice_bot_provider_sid

    resp = _vapi_request("GET", f"{VAPI_BASE_URL}/call",
                         headers=_vapi_headers(), params=params)
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code,
                            detail=f"Failed to fetch calls: {resp.text}")

    recordings = []
    for call in resp.json():
        if not params and call.get("phoneNumberId") != user.voice_bot_provider_sid:
            continue
        url = call.get("artifact", {}).get("recordingUrl")
        if url:
            recordings.append({"url": url, "createdAt": call.get("createdAt"), "id": call.get("id")})

    return {"recordings": recordings}


# ===========================================================================
# MEETINGS (dashboard view)
# ===========================================================================

@router.get("/meetings")
def get_meetings(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id_from_token),
):
    """Return all meeting bookings captured by the voice bot for this user."""
    try:
        rows = db.execute(text("""
            SELECT id, name, email, meeting_date, notes, created_at
            FROM voice_bot_meetings
            WHERE user_id = :uid
            ORDER BY created_at DESC
        """), {"uid": user_id}).fetchall()
    except Exception:
        return {"meetings": []}

    return {
        "meetings": [
            {"id": r[0], "name": r[1], "email": r[2],
             "meeting_date": r[3], "notes": r[4], "created_at": str(r[5])}
            for r in rows
        ]
    }
