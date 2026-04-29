"""
Simple encryption utilities for storing sensitive data.
In production, use proper key management (e.g., AWS KMS, HashiCorp Vault).
"""
import base64
import os
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from backend.config import get_settings


DEFAULT_ENCRYPTION_SECRET = "content-factory-dev-secret-key-change-in-prod"


def _get_encryption_key() -> bytes:
    """Derive encryption key from a secret."""
    settings = get_settings()
    # Use a combination of values as the base secret
    # In production, use a proper secret management system
    secret = os.environ.get("ENCRYPTION_SECRET", DEFAULT_ENCRYPTION_SECRET)
    salt = b"content-factory-salt"  # In production, store this securely

    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(secret.encode()))
    return key


def encrypt(plaintext: str) -> str:
    """Encrypt a string and return base64-encoded ciphertext."""
    key = _get_encryption_key()
    f = Fernet(key)
    encrypted = f.encrypt(plaintext.encode())
    return base64.urlsafe_b64encode(encrypted).decode()


def decrypt(ciphertext: str) -> str:
    """Decrypt base64-encoded ciphertext and return plaintext."""
    key = _get_encryption_key()
    f = Fernet(key)
    encrypted = base64.urlsafe_b64decode(ciphertext.encode())
    decrypted = f.decrypt(encrypted)
    return decrypted.decode()


def mask_key(key: str, visible_chars: int = 4) -> str:
    """Mask an API key, showing only last few characters."""
    if len(key) <= visible_chars:
        return "••••"
    return "••••" + key[-visible_chars:]


def encryption_status() -> dict[str, object]:
    """Return non-sensitive diagnostics about current encryption setup."""
    secret = os.environ.get("ENCRYPTION_SECRET", DEFAULT_ENCRYPTION_SECRET)
    using_default = secret == DEFAULT_ENCRYPTION_SECRET
    return {
        "configured": bool(secret),
        "using_default_secret": using_default,
        "storage_mode": "fernet-derived",
        "secret_source": "env" if "ENCRYPTION_SECRET" in os.environ else "builtin-dev-fallback",
    }
