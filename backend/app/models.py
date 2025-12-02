from sqlalchemy import Column, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), unique=True, index=True, nullable=True)  # References auth.users(id)
    facebook_id = Column(String, unique=True, index=True)
    name = Column(String)
    session_token = Column(String)
