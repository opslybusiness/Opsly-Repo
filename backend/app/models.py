from sqlalchemy import Column, Integer, String, DateTime, Numeric
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


class FinancialData(Base):
    __tablename__ = "financial_data"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), index=True, nullable=True)  # References auth.users(id)
    date = Column(DateTime, nullable=False, index=True)
    amount = Column(Numeric(15, 2), nullable=False)  # Decimal with 2 decimal places
    transaction_type = Column(String, nullable=False, default='expense', index=True)  # 'income' or 'expense'
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
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
