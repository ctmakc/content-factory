"""
Distribution API endpoints - scheduling and posting content.
"""
import json
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.agents.poster import PosterAgent
from backend.database import get_db
from backend.models import Account, Content, Platform, Post, PostStatus

router = APIRouter(prefix="/distribution", tags=["distribution"])


class ScheduleRequest(BaseModel):
    """Request body for scheduling a post."""

    content_id: int
    account_id: int
    platform: str
    scheduled_at: Optional[datetime] = None


class PostNowRequest(BaseModel):
    """Request body for immediate posting."""

    content_id: int
    platform: str
    account_id: Optional[int] = None


class PostResponse(BaseModel):
    """Response for post data."""

    id: int
    content_id: int
    account_id: int
    platform: str
    post_text: str
    status: str
    scheduled_at: Optional[str]
    posted_at: Optional[str]
    external_id: Optional[str]
    error_message: Optional[str]


class AccountCreate(BaseModel):
    """Request body for creating an account."""

    platform: str
    username: str
    display_name: Optional[str] = None
    access_token: Optional[str] = None


class AccountResponse(BaseModel):
    """Response for account data."""

    id: int
    platform: str
    username: str
    display_name: Optional[str]
    is_active: bool


@router.post("/accounts", response_model=AccountResponse)
async def create_account(
    request: AccountCreate,
    db: AsyncSession = Depends(get_db),
) -> Account:
    """Register a social media account."""
    account = Account(
        platform=request.platform,
        username=request.username,
        display_name=request.display_name,
        access_token=request.access_token,
    )
    db.add(account)
    await db.flush()
    await db.refresh(account)
    return account


@router.get("/accounts", response_model=list[AccountResponse])
async def list_accounts(
    db: AsyncSession = Depends(get_db),
) -> list[Account]:
    """List all registered accounts."""
    result = await db.execute(select(Account).where(Account.is_active == True))
    return list(result.scalars().all())


@router.post("/schedule", response_model=PostResponse)
async def schedule_post(
    request: ScheduleRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Schedule content for posting.

    Creates a post entry with SCHEDULED status.
    """
    # Verify content exists
    result = await db.execute(select(Content).where(Content.id == request.content_id))
    content = result.scalar_one_or_none()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    # Verify account exists
    result = await db.execute(select(Account).where(Account.id == request.account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # Get platform-specific content
    platform_versions = json.loads(content.platform_versions) if content.platform_versions else {}
    post_text = platform_versions.get(request.platform.lower(), content.raw_content)

    # Create scheduled post
    post = Post(
        content_id=content.id,
        account_id=account.id,
        platform=request.platform,
        post_text=post_text,
        status=PostStatus.SCHEDULED.value,
        scheduled_at=request.scheduled_at,
    )
    db.add(post)
    await db.flush()
    await db.refresh(post)

    return {
        "id": post.id,
        "content_id": post.content_id,
        "account_id": post.account_id,
        "platform": post.platform,
        "post_text": post.post_text,
        "status": post.status,
        "scheduled_at": post.scheduled_at.isoformat() if post.scheduled_at else None,
        "posted_at": None,
        "external_id": None,
        "error_message": None,
    }


@router.post("/post", response_model=PostResponse)
async def post_now(
    request: PostNowRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Post content immediately.

    For MVP without full OAuth, returns the formatted content
    ready for manual posting.
    """
    # Verify content exists
    result = await db.execute(select(Content).where(Content.id == request.content_id))
    content = result.scalar_one_or_none()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    # Get or create a placeholder account
    if request.account_id:
        result = await db.execute(select(Account).where(Account.id == request.account_id))
        account = result.scalar_one_or_none()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
    else:
        # Check for existing placeholder account
        result = await db.execute(
            select(Account).where(
                Account.platform == request.platform,
                Account.username == "manual_posting",
            )
        )
        account = result.scalar_one_or_none()
        if not account:
            account = Account(
                platform=request.platform,
                username="manual_posting",
                display_name="Manual Posting",
            )
            db.add(account)
            await db.flush()
            await db.refresh(account)

    # Get platform-specific content
    platform_versions = json.loads(content.platform_versions) if content.platform_versions else {}
    post_text = platform_versions.get(request.platform.lower(), content.raw_content)

    # Format for platform
    agent = PosterAgent()
    formatted_text = agent.format_for_platform(request.platform, post_text)

    # Attempt to post
    credentials = {"access_token": account.access_token} if account.access_token else None
    post_result = await agent.post_to_platform(
        platform=request.platform,
        content=formatted_text,
        account_credentials=credentials,
    )

    # Create post record
    post = Post(
        content_id=content.id,
        account_id=account.id,
        platform=request.platform,
        post_text=formatted_text,
        status=PostStatus.POSTED.value if post_result.success else PostStatus.FAILED.value,
        posted_at=post_result.posted_at,
        external_id=post_result.external_id,
        error_message=post_result.error_message,
        metrics=json.dumps(post_result.metrics) if post_result.metrics else None,
    )
    db.add(post)
    await db.flush()
    await db.refresh(post)

    return {
        "id": post.id,
        "content_id": post.content_id,
        "account_id": post.account_id,
        "platform": post.platform,
        "post_text": post.post_text,
        "status": post.status,
        "scheduled_at": None,
        "posted_at": post.posted_at.isoformat() if post.posted_at else None,
        "external_id": post.external_id,
        "error_message": post.error_message,
    }


@router.get("/posts", response_model=list[PostResponse])
async def list_posts(
    status: Optional[str] = None,
    platform: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """List all posts with optional filters."""
    query = select(Post)

    if status:
        query = query.where(Post.status == status)
    if platform:
        query = query.where(Post.platform == platform)

    query = query.order_by(Post.created_at.desc())
    result = await db.execute(query)
    posts = result.scalars().all()

    return [
        {
            "id": p.id,
            "content_id": p.content_id,
            "account_id": p.account_id,
            "platform": p.platform,
            "post_text": p.post_text,
            "status": p.status,
            "scheduled_at": p.scheduled_at.isoformat() if p.scheduled_at else None,
            "posted_at": p.posted_at.isoformat() if p.posted_at else None,
            "external_id": p.external_id,
            "error_message": p.error_message,
        }
        for p in posts
    ]


@router.get("/posts/{post_id}", response_model=PostResponse)
async def get_post(
    post_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Get a specific post."""
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    return {
        "id": post.id,
        "content_id": post.content_id,
        "account_id": post.account_id,
        "platform": post.platform,
        "post_text": post.post_text,
        "status": post.status,
        "scheduled_at": post.scheduled_at.isoformat() if post.scheduled_at else None,
        "posted_at": post.posted_at.isoformat() if post.posted_at else None,
        "external_id": post.external_id,
        "error_message": post.error_message,
    }
