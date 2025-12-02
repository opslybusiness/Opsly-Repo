"""
Authentication utilities for extracting user_id from Supabase JWT tokens
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import os
from typing import Optional
from uuid import UUID

# Security scheme
security = HTTPBearer()

# Supabase JWT secret - get from environment variable
# This is your Supabase JWT secret from Project Settings > API > JWT Secret
# NOT the anon key or service role key
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

if not SUPABASE_JWT_SECRET:
    # Fallback: try to get from SUPABASE_URL (if using service role)
    # For production, always set SUPABASE_JWT_SECRET in environment
    print("WARNING: SUPABASE_JWT_SECRET not set. JWT verification may fail.")
    print("Set SUPABASE_JWT_SECRET in your .env file with the JWT Secret from Supabase Project Settings > API")


def get_user_id_from_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """
    Extract and verify user_id from Supabase JWT token in Authorization header.
    
    Returns the user_id (UUID) as a string.
    Raises HTTPException if token is invalid or missing.
    """
    token = credentials.credentials
    
    if not SUPABASE_JWT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="JWT secret not configured"
        )
    
    try:
        # Decode and verify the JWT token
        # Supabase uses HS256 algorithm
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False}  # Supabase tokens may not have standard aud claim
        )
        
        # Extract user_id from the token payload
        # Supabase stores user id in the 'sub' claim
        user_id = payload.get("sub")
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found in token"
            )
        
        # Validate it's a valid UUID
        try:
            UUID(user_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid user ID format in token"
            )
        
        return user_id
        
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {str(e)}"
        )


def get_optional_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
) -> Optional[str]:
    """
    Optional version - returns None if no token is provided.
    Useful for endpoints that work with or without authentication.
    """
    if not credentials:
        return None
    
    try:
        return get_user_id_from_token(credentials)
    except HTTPException:
        return None

