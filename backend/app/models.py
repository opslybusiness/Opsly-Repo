from sqlalchemy import Column, Integer, String, DateTime, Numeric
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), unique=True, index=True, nullable=True)  # References auth.users(id)
    facebook_id = Column(String, unique=True, index=True)
    name = Column(String)
    session_token = Column(String)


class FinancialData(Base):
    __tablename__ = "financial_data"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), index=True, nullable=True)  # References auth.users(id)
    date = Column(DateTime, nullable=False, index=True)
    amount = Column(Numeric(15, 2), nullable=False)  # Decimal with 2 decimal places
    created_at = Column(DateTime, default=datetime.utcnow)
