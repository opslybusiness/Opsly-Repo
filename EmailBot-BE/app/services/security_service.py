"""Security helpers for encrypting sensitive fields at rest."""
import base64
import hashlib
import os
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken


class SecurityService:
    """Encrypt/decrypt helpers backed by a stable application key."""

    def __init__(self):
        secret = os.getenv("SMTP_ENCRYPTION_KEY") or os.getenv("SUPABASE_JWT_SECRET") or ""
        if not secret:
            raise RuntimeError(
                "Missing SMTP_ENCRYPTION_KEY or SUPABASE_JWT_SECRET required for SMTP password encryption"
            )
        digest = hashlib.sha256(secret.encode("utf-8")).digest()
        key = base64.urlsafe_b64encode(digest)
        self._fernet = Fernet(key)

    def encrypt(self, value: Optional[str]) -> Optional[str]:
        if not value:
            return value
        if value.startswith("enc::"):
            return value
        token = self._fernet.encrypt(value.encode("utf-8")).decode("utf-8")
        return f"enc::{token}"

    def decrypt(self, value: Optional[str]) -> Optional[str]:
        if not value:
            return value
        if not value.startswith("enc::"):
            return value
        try:
            token = value.split("enc::", 1)[1]
            return self._fernet.decrypt(token.encode("utf-8")).decode("utf-8")
        except (InvalidToken, ValueError):
            return None
