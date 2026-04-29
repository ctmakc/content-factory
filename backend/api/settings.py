"""
Settings API endpoints - manage API keys and social accounts.
"""
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.crypto import decrypt, encrypt, encryption_status, mask_key
from backend.database import get_db
from backend.models import Account, ApiKey

router = APIRouter(prefix="/settings", tags=["settings"])


# ============ API Keys ============

class ApiKeyCreate(BaseModel):
    """Request body for creating an API key."""
    provider: str
    name: str
    api_key: str


class ApiKeyResponse(BaseModel):
    """Response for API key data (masked)."""
    id: int
    provider: str
    name: str
    api_key_masked: str
    is_default: bool
    is_active: bool


class ApiKeyUpdate(BaseModel):
    """Request body for updating an API key."""
    name: Optional[str] = None
    api_key: Optional[str] = None
    is_default: Optional[bool] = None


@router.get("/security-status")
async def get_security_status(
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Return non-sensitive diagnostics about key storage and account readiness."""
    api_result = await db.execute(select(ApiKey).where(ApiKey.is_active == True))  # noqa: E712
    account_result = await db.execute(select(Account).where(Account.is_active == True))  # noqa: E712
    api_keys = api_result.scalars().all()
    accounts = account_result.scalars().all()

    providers: dict[str, dict[str, Any]] = {}
    for item in api_keys:
        provider = providers.setdefault(item.provider, {"count": 0, "defaults": 0})
        provider["count"] += 1
        if item.is_default:
            provider["defaults"] += 1

    platforms: dict[str, dict[str, Any]] = {}
    for item in accounts:
        platform = platforms.setdefault(item.platform, {"count": 0, "connected": 0})
        platform["count"] += 1
        if item.access_token:
            platform["connected"] += 1

    return {
        "crypto": encryption_status(),
        "api_keys": {
            "total": len(api_keys),
            "providers": providers,
        },
        "accounts": {
            "total": len(accounts),
            "platforms": platforms,
        },
    }


@router.post("/api-keys", response_model=ApiKeyResponse)
async def create_api_key(
    request: ApiKeyCreate,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Create a new API key."""
    # Check if this is the first key for this provider
    result = await db.execute(
        select(ApiKey).where(ApiKey.provider == request.provider, ApiKey.is_active == True)
    )
    existing_keys = result.scalars().all()
    is_default = len(existing_keys) == 0

    # Encrypt the API key
    encrypted_key = encrypt(request.api_key)

    api_key = ApiKey(
        provider=request.provider,
        name=request.name,
        api_key_encrypted=encrypted_key,
        is_default=is_default,
    )
    db.add(api_key)
    await db.flush()
    await db.refresh(api_key)

    return {
        "id": api_key.id,
        "provider": api_key.provider,
        "name": api_key.name,
        "api_key_masked": mask_key(request.api_key),
        "is_default": api_key.is_default,
        "is_active": api_key.is_active,
    }


@router.get("/api-keys", response_model=list[ApiKeyResponse])
async def list_api_keys(
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """List all API keys (masked)."""
    result = await db.execute(
        select(ApiKey).where(ApiKey.is_active == True).order_by(ApiKey.created_at.desc())
    )
    keys = result.scalars().all()

    return [
        {
            "id": k.id,
            "provider": k.provider,
            "name": k.name,
            "api_key_masked": "••••" + decrypt(k.api_key_encrypted)[-4:] if k.api_key_encrypted else "••••",
            "is_default": k.is_default,
            "is_active": k.is_active,
        }
        for k in keys
    ]


@router.patch("/api-keys/{key_id}", response_model=ApiKeyResponse)
async def update_api_key(
    key_id: int,
    request: ApiKeyUpdate,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Update an API key."""
    result = await db.execute(select(ApiKey).where(ApiKey.id == key_id))
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")

    if request.name is not None:
        api_key.name = request.name

    if request.api_key is not None:
        api_key.api_key_encrypted = encrypt(request.api_key)

    if request.is_default is not None and request.is_default:
        # Set all other keys of same provider to non-default
        await db.execute(
            update(ApiKey)
            .where(ApiKey.provider == api_key.provider, ApiKey.id != key_id)
            .values(is_default=False)
        )
        api_key.is_default = True

    await db.flush()
    await db.refresh(api_key)

    decrypted_key = decrypt(api_key.api_key_encrypted) if api_key.api_key_encrypted else ""
    return {
        "id": api_key.id,
        "provider": api_key.provider,
        "name": api_key.name,
        "api_key_masked": mask_key(decrypted_key),
        "is_default": api_key.is_default,
        "is_active": api_key.is_active,
    }


@router.delete("/api-keys/{key_id}")
async def delete_api_key(
    key_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Delete (deactivate) an API key."""
    result = await db.execute(select(ApiKey).where(ApiKey.id == key_id))
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")

    api_key.is_active = False
    return {"status": "deleted"}


@router.post("/api-keys/{key_id}/set-default")
async def set_default_api_key(
    key_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Set an API key as the default for its provider."""
    result = await db.execute(select(ApiKey).where(ApiKey.id == key_id))
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")

    # Set all other keys of same provider to non-default
    await db.execute(
        update(ApiKey)
        .where(ApiKey.provider == api_key.provider)
        .values(is_default=False)
    )

    api_key.is_default = True
    return {"status": "ok"}


# ============ Social Accounts ============

class SocialAccountCreate(BaseModel):
    """Request body for creating a social account."""
    platform: str
    username: str
    display_name: Optional[str] = None
    access_token: Optional[str] = None


class SocialAccountResponse(BaseModel):
    """Response for social account data."""
    id: int
    platform: str
    username: str
    display_name: Optional[str]
    is_connected: bool
    is_active: bool


@router.post("/social-accounts", response_model=SocialAccountResponse)
async def create_social_account(
    request: SocialAccountCreate,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Create a new social account."""
    # Encrypt access token if provided
    encrypted_token = encrypt(request.access_token) if request.access_token else None

    account = Account(
        platform=request.platform,
        username=request.username,
        display_name=request.display_name,
        access_token=encrypted_token,
    )
    db.add(account)
    await db.flush()
    await db.refresh(account)

    return {
        "id": account.id,
        "platform": account.platform,
        "username": account.username,
        "display_name": account.display_name,
        "is_connected": account.access_token is not None,
        "is_active": account.is_active,
    }


@router.get("/social-accounts", response_model=list[SocialAccountResponse])
async def list_social_accounts(
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """List all social accounts."""
    result = await db.execute(
        select(Account).where(Account.is_active == True).order_by(Account.created_at.desc())
    )
    accounts = result.scalars().all()

    return [
        {
            "id": a.id,
            "platform": a.platform,
            "username": a.username,
            "display_name": a.display_name,
            "is_connected": a.access_token is not None,
            "is_active": a.is_active,
        }
        for a in accounts
    ]


@router.delete("/social-accounts/{account_id}")
async def delete_social_account(
    account_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Delete (deactivate) a social account."""
    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    account.is_active = False
    return {"status": "deleted"}


# ============ Helper to get active API key ============

async def get_active_api_key(provider: str, db: AsyncSession) -> Optional[str]:
    """Get the decrypted API key for a provider."""
    result = await db.execute(
        select(ApiKey).where(
            ApiKey.provider == provider,
            ApiKey.is_active == True,
            ApiKey.is_default == True,
        )
    )
    api_key = result.scalar_one_or_none()

    if not api_key:
        # Try to get any active key for this provider
        result = await db.execute(
            select(ApiKey).where(
                ApiKey.provider == provider,
                ApiKey.is_active == True,
            )
        )
        api_key = result.scalar_one_or_none()

    if api_key:
        return decrypt(api_key.api_key_encrypted)

    return None
