"""
Database models for Content Factory.
"""
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class CampaignStatus(str, Enum):
    """Campaign status options."""

    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"


class ContentType(str, Enum):
    """Content type options."""

    ARTICLE = "article"
    SOCIAL_POST = "social_post"
    VIDEO_SCRIPT = "video_script"
    EMAIL = "email"


class Platform(str, Enum):
    """Social media platforms."""

    LINKEDIN = "linkedin"
    TWITTER = "twitter"
    INSTAGRAM = "instagram"
    YOUTUBE = "youtube"
    FACEBOOK = "facebook"


class PostStatus(str, Enum):
    """Post status options."""

    DRAFT = "draft"
    SCHEDULED = "scheduled"
    POSTED = "posted"
    FAILED = "failed"


class Campaign(Base):
    """Marketing campaign."""

    __tablename__ = "campaigns"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    niche: Mapped[str] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default=CampaignStatus.DRAFT.value)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    research: Mapped[list["Research"]] = relationship(back_populates="campaign")
    content: Mapped[list["Content"]] = relationship(back_populates="campaign")


class Research(Base):
    """Market research data for a campaign."""

    __tablename__ = "research"

    id: Mapped[int] = mapped_column(primary_key=True)
    campaign_id: Mapped[int] = mapped_column(ForeignKey("campaigns.id"))

    # Research data stored as JSON strings
    market_analysis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    target_audience: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    competitors: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    content_angles: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    platform_recommendations: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    campaign: Mapped["Campaign"] = relationship(back_populates="research")


class Content(Base):
    """Generated content."""

    __tablename__ = "content"

    id: Mapped[int] = mapped_column(primary_key=True)
    campaign_id: Mapped[int] = mapped_column(ForeignKey("campaigns.id"))

    title: Mapped[str] = mapped_column(String(500))
    content_type: Mapped[str] = mapped_column(String(50), default=ContentType.SOCIAL_POST.value)
    topic: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Raw generated content
    raw_content: Mapped[str] = mapped_column(Text)

    # Platform-adapted versions (JSON string)
    platform_versions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    campaign: Mapped["Campaign"] = relationship(back_populates="content")
    posts: Mapped[list["Post"]] = relationship(back_populates="content")


class Account(Base):
    """Social media account credentials."""

    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    platform: Mapped[str] = mapped_column(String(50))
    username: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Encrypted credentials (use proper encryption in production)
    credentials_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    access_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    refresh_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    posts: Mapped[list["Post"]] = relationship(back_populates="account")


class AIProvider(str, Enum):
    """AI provider options."""

    OPENAI = "openai"
    ANTHROPIC = "anthropic"


class ApiKey(Base):
    """API keys for AI providers."""

    __tablename__ = "api_keys"

    id: Mapped[int] = mapped_column(primary_key=True)
    provider: Mapped[str] = mapped_column(String(50))
    name: Mapped[str] = mapped_column(String(255))

    # Encrypted API key
    api_key_encrypted: Mapped[str] = mapped_column(Text)

    is_default: Mapped[bool] = mapped_column(default=False)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Post(Base):
    """Scheduled or published posts."""

    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    content_id: Mapped[int] = mapped_column(ForeignKey("content.id"))
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"))

    platform: Mapped[str] = mapped_column(String(50))
    post_text: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default=PostStatus.DRAFT.value)

    scheduled_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    posted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # External post ID from the platform
    external_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Metrics (JSON string)
    metrics: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    content: Mapped["Content"] = relationship(back_populates="posts")
    account: Mapped["Account"] = relationship(back_populates="posts")
