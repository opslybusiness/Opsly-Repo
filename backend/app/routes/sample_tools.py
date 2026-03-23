from fastapi import (
    FastAPI,
    HTTPException,
    Form,
    Request,
    File,
    UploadFile,
    Depends,
    Header,
)
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Union
from datetime import datetime
import json, os
import numpy as np
from fastapi.encoders import jsonable_encoder
from sqlmodel import select, Session
import httpx
from httpx import TimeoutException
from dotenv import load_dotenv
from fastapi.responses import (
    FileResponse,
    RedirectResponse,
    Response,
    PlainTextResponse,
)
from google_auth_oauthlib.flow import Flow
from twilio.twiml.messaging_response import MessagingResponse
from contextlib import asynccontextmanager
from DB.db import *
from utils.calendar_utils import GoogleCalendar
from vapi.rag import RAGEngine
from vapi.bounded_usage import MessageLimiter
from config import (
    CREDENTIALS_FILE,
    REDIRECT_URI,
    timeout,
    DAILY_LIMIT,
    TWILIO_PHONE_NUMBER,
    SCOPES,
)
from sqlalchemy import update
from fastapi.middleware.cors import CORSMiddleware
from DB.sync import sync_apartment_listings
from utils.auth_module import get_current_realtor_id, get_current_user_data
from fastapi import Body
from fastapi import Request
from fastapi.responses import JSONResponse
from sqlmodel import select, Session
import jwt
from twilio.rest import Client


load_dotenv()  # Load .env values


VAPI_API_KEY = os.getenv("VAPI_API_KEY")
VAPI_ASSISTANT_ID = os.getenv("VAPI_ASSISTANT_ID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
VAPI_BASE_URL = "https://api.vapi.ai"
headers = {"Authorization": f"Bearer {VAPI_API_KEY}"}


# ----------------- For Automatic Number Buying from Twilio ---------------------
TWILIO_ACCOUNT_SID2 = os.getenv("TWILIO_ACCOUNT_SID2")
TWILIO_ACCOUNT_SID1 = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN2 = os.getenv("TWILIO_AUTH_TOKEN2")
TWILIO_AUTH_TOKEN1 = os.getenv("TWILIO_AUTH_TOKEN")
VAPI_API_KEY2 = os.getenv("VAPI_API_KEY2")
VAPI_ASSISTANT_ID2 = os.getenv("VAPI_ASSISTANT_ID2")

twillio_client = Client(TWILIO_ACCOUNT_SID2, TWILIO_AUTH_TOKEN2)
twillio_client1 = Client(TWILIO_ACCOUNT_SID1, TWILIO_AUTH_TOKEN1)

# ---------------------------------------------------------------------
# ---------------------------------------------------------------------


rag = RAGEngine()  # pgvector RAG

message_limiter = MessageLimiter(DAILY_LIMIT)
session = Session(engine)


# ------------------ ToolCall Models ------------------ #
class ToolCallFunction(BaseModel):
    name: str
    arguments: Union[str, dict]


class ToolCall(BaseModel):
    id: str
    function: ToolCallFunction


class Message(BaseModel):
    toolCalls: list[ToolCall]


class VapiRequest(BaseModel):
    message: Message


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()

    yield  # This is where FastAPI app runs

    print("Shutting down fastapi app...")


app = FastAPI(lifespan=lifespan)

# set orgin here
origins = [
    "https://react-app-form.onrender.com/",
    "https://react-app-form.onrender.com",
    "https://leaseap.com",
    "https://leaseap.com/",
    "https://www.leasap.com",
    "https://www.leasap.com/",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------ Query Docs ------------------ #
@app.post("/query_docs/")
def query_docs(request: VapiRequest):

    for tool_call in request.message.toolCalls:
        if tool_call.function.name == "queryDocs":
            args = tool_call.function.arguments
            if isinstance(args, str):
                args = json.loads(args)
            question = args.get("query")
            address = args.get("address")
            if not question:
                raise HTTPException(status_code=400, detail="Missing query text")

    print("Address:", address)
    with Session(engine) as session:
        # Step 1: Get count of listings for the given address (case-insensitive)
        count_sql = text(
            """
        SELECT COUNT(*) 
        FROM apartmentlisting
        WHERE LOWER(listing_metadata->>'address') = LOWER(:addr)
    """
        ).params(addr=address)

        total_matches = session.exec(count_sql).scalar()

        if total_matches == 0:
            raise HTTPException(
                status_code=404, detail="No listings found for given address"
            )
        # Step 2: Choose a random offset
        import random

        random_offset = random.randint(0, total_matches - 1)

        # Step 3: Fetch one random source_id using OFFSET
        source_sql = text(
            """
    SELECT source_id
    FROM apartmentlisting
    WHERE LOWER(listing_metadata->>'address') = LOWER(:addr)
    OFFSET :offset LIMIT 1
"""
        ).params(addr=address, offset=random_offset)

        row = session.exec(source_sql).first()
        if row:
            source_id = row[0]
        else:
            source_id = None

        # Step 4: Process tool call

        response = rag.query(question, source_id=source_id)
        return {"results": [{"toolCallId": tool_call.id, "result": response}]}

    raise HTTPException(status_code=400, detail="Invalid tool call")





# ------------------ Calendar Tools ------------------ #
@app.post("/get_date/")
def get_date(request: VapiRequest):
    for tool_call in request.message.toolCalls:
        if tool_call.function.name == "getDate":
            return {
                "results": [
                    {
                        "toolCallId": tool_call.id,
                        "result": {"date": datetime.now().date().isoformat()},
                    }
                ]
            }
    return {"error": "Invalid tool call"}


@app.post("/book_visit/")
def book_visit(request: VapiRequest):
    print("Request:", request)

    for tool_call in request.message.toolCalls:
        if tool_call.function.name == "bookVisit":
            args = tool_call.function.arguments
            if isinstance(args, str):
                args = json.loads(args)

            contact = args.get("contact")
            email = args.get("email")
            date_str = args.get("date")
            address = args.get("address")
            print("Booking:", contact, email, date_str, address)

            if not (contact and email and date_str and address):
                raise HTTPException(status_code=400, detail="Missing required fields")

            # Parse datetime
            try:
                dt = datetime.strptime(date_str, "%Y-%m-%d %H:%M")
                booking_date = dt.date()
                booking_time = dt.time()
            except ValueError:
                raise HTTPException(
                    status_code=400, detail="Invalid date format. Use YYYY-MM-DD HH:MM"
                )

            with Session(engine) as session:
                # Find the listing by matching address substring in text
                statement = select(ApartmentListing).where(
                    ApartmentListing.text.contains(address)
                )
                listing = session.exec(statement).first()
                if not listing:
                    raise HTTPException(
                        status_code=404, detail="Listing not found for address"
                    )

                # Get source using source_id
                print("Source ID:", listing.source_id)
                statement = select(Source).where(Source.source_id == listing.source_id)
                source = session.exec(statement).first()
                if not source:
                    raise HTTPException(status_code=404, detail="Source not found")

                # Access realtor_id from source
                realtor_id = source.realtor_id
                print("Realtor ID:", realtor_id)

            # Initialize calendar client with correct token
            calendar = GoogleCalendar(realtor_id)

            # Check availability
            if not calendar.is_time_available(date_str):
                return {
                    "results": [
                        {
                            "toolCallId": tool_call.id,
                            "result": f"Time {date_str} not available.",
                        }
                    ]
                }

            # Create calendar event
            summary = f"Apartment Visit for: {address}"
            description = f"Apartment Visit Booking\nEmail: {email}\nAddress: {address}"
            event = calendar.create_event(
                date_str, summary=summary, email=email, description=description
            )

            try:
                created = create_booking_entry(
                    address, booking_date, booking_time, contact
                )
                print("Booking created:", created)
            except Exception as e:
                print("Failed to create booking:", e)

            return {
                "results": [
                    {
                        "toolCallId": tool_call.id,
                        "result": f"Booking confirmed! Event link: {event.get('htmlLink')}",
                    }
                ]
            }

    raise HTTPException(status_code=400, detail="Invalid tool call")


@app.post("/get_slots/")
def get_slots(request: VapiRequest):
    for tool_call in request.message.toolCalls:
        if tool_call.function.name == "getAvailableSlots":
            args = tool_call.function.arguments
            if isinstance(args, str):
                try:
                    args = json.loads(args)
                except json.JSONDecodeError:
                    args = {"date": args}

            date = args.get("date")
            address = args.get("address")
            print("Address:", address)
            if not date:
                raise HTTPException(
                    status_code=400, detail="Missing 'date' or 'address' field"
                )

            # 1. Find the listing by matching address substring in text
            statement = select(ApartmentListing).where(
                ApartmentListing.text.contains(address)
            )
            listing = session.exec(statement).first()
            if not listing:
                raise HTTPException(
                    status_code=404, detail="Listing not found for address"
                )

            # 2. Get source using the source_id
            print("Source ID (slots):", listing.source_id)
            statement = select(Source).where(Source.source_id == listing.source_id)
            source = session.exec(statement).first()
            if not source:
                raise HTTPException(status_code=404, detail="Source not found")

            # 3. Access the realtor_id from the source
            realtor_id = source.realtor_id
            print("Realtor ID (slots):", source.realtor_id)

            # 🧠 3. Initialize calendar client with correct token
            calendar = GoogleCalendar(realtor_id)

            slots = calendar.get_free_slots(date)
            return {
                "results": [
                    {
                        "toolCallId": tool_call.id,
                        "result": f"Available slots on {date}:\n" + ", ".join(slots),
                    }
                ]
            }
    raise HTTPException(status_code=400, detail="Invalid tool call")


# temp store
temp_state_store = {}
# -------------------- Google Calendar ------------------------------------
@app.get("/authorize/")
def authorize_realtor(realtor_id: int):
    flow = Flow.from_client_secrets_file(
        CREDENTIALS_FILE, scopes=SCOPES, redirect_uri=REDIRECT_URI
    )
    auth_url, state = flow.authorization_url(
        prompt="consent", include_granted_scopes="true"
    )

    temp_state_store[state] = realtor_id
    return RedirectResponse(auth_url)


@app.get("/oauth2callback")
def oauth2callback(request: Request):
    with Session(engine) as session:
        state = request.query_params.get("state")
        realtor_id = temp_state_store.get(state)

        if not realtor_id:
            return Response(content="Invalid or expired state", status_code=400)

        flow = Flow.from_client_secrets_file(
            CREDENTIALS_FILE, scopes=SCOPES, redirect_uri=REDIRECT_URI, state=state
        )

        flow.fetch_token(authorization_response=str(request.url))

        credentials_data = {
            "token": flow.credentials.token,
            "refresh_token": flow.credentials.refresh_token,
            "token_uri": flow.credentials.token_uri,
            "client_id": flow.credentials.client_id,
            "client_secret": flow.credentials.client_secret,
            "scopes": flow.credentials.scopes,
            "expiry": (
                flow.credentials.expiry.isoformat() if flow.credentials.expiry else None
            ),
        }

        stmt = (
            update(Realtor)
            .where(Realtor.realtor_id == realtor_id)
            .values(credentials=json.dumps(credentials_data))
        )

        session.exec(stmt)
        session.commit()

        return Response(
            content=f"Authorization successful for realtor_id {realtor_id}."
        )


# ------------------ Health Check ------------------ #
@app.get("/health")
def health_check():
    return {"status": "healthy", "message": "Lease Copilot is running"}

@app.post("/CreateRealtor")
async def create_realtor_endpoint(
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    contact: str = Form(...),
    property_manager_id: int = Form(None),
):
    """Create a new Realtor (standalone or under a Property Manager)."""
    try:
        # Step 1: Create Supabase Auth user
        auth_response = supabase.auth.sign_up({"email": email, "password": password})

        if not auth_response.user:
            raise HTTPException(
                status_code=400, detail="Failed to create Supabase user"
            )

        auth_user_id = str(auth_response.user.id)  # Supabase UUID

        # Step 2: Pass auth_user_id into DB creation function
        result = create_realtor(
            auth_user_id=auth_user_id,
            name=name,
            email=email,
            contact=contact,
            property_manager_id=property_manager_id,
        )

        return JSONResponse(content=result, status_code=200)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def get_db():
    with Session(engine) as session:
        yield session

@app.get("/recordings")
def get_recordings(realtor_id: int = Depends(get_current_realtor_id)):
    recordings = []

    # Step 1: Look up the realtor in DB to get their Twilio number
    with Session(engine) as session:
        realtor = session.exec(select(Realtor).where(Realtor.realtor_id == realtor_id)).first()

        if not realtor:
            raise HTTPException(status_code=404, detail="Realtor not found")

        if not realtor.twilio_contact:
            raise HTTPException(
                status_code=400,
                detail="Realtor does not have a Twilio contact configured",
            )

        twilio_number = realtor.twilio_contact
        print("from supabse got twilio contact:", twilio_number)

    # Step 2: Fetch all calls from VAPI
    resp = requests.get(f"{VAPI_BASE_URL}/call", headers=headers)
    calls = resp.json()

    for call in calls:
        # Step 3: Get the phoneNumberId from the call
        phone_number_id = call.get("phoneNumberId")
        print("phone from vapi call id", phone_number_id)
        if not phone_number_id:
            continue

        # Step 4: Look up the number against the phoneNumberId
        pn_resp = requests.get(
            f"{VAPI_BASE_URL}/phone-number/{phone_number_id}", headers=headers
        )
        if pn_resp.status_code != 200:
            continue

        bot_number = pn_resp.json().get("number")
        print("bot number from vapi", bot_number)

        # Step 5: Match with realtor’s Twilio contact
        if bot_number != twilio_number:
            continue

        # Step 7: Extract recordings if available
        recording_url = call.get("artifact", {}).get("recordingUrl")

        if recording_url:
            recordings.append({"url": recording_url})

    return {"recordings": recordings}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
