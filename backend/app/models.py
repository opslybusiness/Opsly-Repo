from sqlalchemy import Column, Integer, String, DateTime, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), unique=True, index=True, nullable=True)  # References auth.users(id)
    facebook_id = Column(String, unique=True, index=True, nullable=True)  # Nullable since not all users have Facebook
    name = Column(String, nullable=True)
    session_token = Column(String, nullable=True)
    # LinkedIn (member — Share on LinkedIn + OpenID)
    linkedin_access_token = Column(Text, nullable=True)
    linkedin_refresh_token = Column(Text, nullable=True)
    linkedin_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    linkedin_person_id = Column(String(128), nullable=True, index=True)
    # Google Calendar / Meet OAuth
    google_access_token = Column(Text, nullable=True)
    google_refresh_token = Column(Text, nullable=True)
    google_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    google_email = Column(String(255), nullable=True, index=True)
    # Voice bot / Vapi integration
    voice_bot_number = Column(String, nullable=True, index=True)
    voice_bot_provider_sid = Column(String, nullable=True, index=True)  # Vapi phone-number object ID
    vapi_assistant_id = Column(String, nullable=True, index=True)       # Vapi assistant ID (per user)
    vapi_system_prompt = Column(String, nullable=True)                  # Business-specific system prompt


class FinancialData(Base):
    __tablename__ = "finance_data"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), index=True, nullable=True)  # References auth.users(id)
    date = Column(DateTime, nullable=False, index=True)
    amount = Column(Numeric(15, 2), nullable=False)  # Decimal with 2 decimal places
    category = Column(String, nullable=True, index=True)  # Expense category (e.g., "Office Supplies", "Travel")
    use_chip = Column(String, nullable=True)  # Transaction method: "Swipe Transaction", "Chip Transaction", or "Online Transaction"
    transaction_type = Column(String, nullable=False, default='expense', index=True)  # Always 'expense' for now
    # Fraud detection fields
    is_fraud = Column(Integer, nullable=True)  # 0 = legitimate, 1 = fraud, NULL = not checked
    fraud_probability = Column(Numeric(5, 4), nullable=True)  # Probability score (0.0000 to 1.0000)
    created_at = Column(DateTime, default=datetime.utcnow)


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True, index=True)  # Category name (e.g., "Office Supplies")
    mcc_code = Column(String, nullable=True)  # Merchant Category Code (e.g., "5970")
    description = Column(String, nullable=True)  # Optional description
    created_at = Column(DateTime, default=datetime.utcnow)


class FraudDetection(Base):
    __tablename__ = "fraud_detections"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), index=True, nullable=True)  # References auth.users(id)
    transaction_id = Column(String, index=True, nullable=True)  # Optional: reference to transaction
    amount = Column(Numeric(15, 2), nullable=False)
    is_fraud = Column(Integer, nullable=False)  # 0 = legitimate, 1 = fraud
    fraud_probability = Column(Numeric(5, 4), nullable=False)  # Probability score (0.0000 to 1.0000)
    merchant_name = Column(String, nullable=True)
    merchant_state = Column(String, nullable=True)
    transaction_date = Column(DateTime, nullable=False, index=True)
    # New fields for the updated fraud detection pipeline
    payment_code = Column(Integer, nullable=True)  # Payment method code
    mcc_simple = Column(Integer, nullable=True)  # Simplified MCC code
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
