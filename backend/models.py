"""
Database models for Content Factory.
"""
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
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


class ArticleReview(Base):
    """Saved editorial review for a generated article artifact."""

    __tablename__ = "article_reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    run_slug: Mapped[str] = mapped_column(String(255), index=True)
    artifact_path: Mapped[str] = mapped_column(String(1000), unique=True, index=True)
    project: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    title: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    usefulness_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    seo_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    geo_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    human_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    brand_fit_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    safety_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    verdict: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tags_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PromptBattleEvaluation(Base):
    """Saved evaluation for a prompt battle candidate."""

    __tablename__ = "prompt_battle_evaluations"

    id: Mapped[int] = mapped_column(primary_key=True)
    battle_slug: Mapped[str] = mapped_column(String(255), index=True)
    candidate_name: Mapped[str] = mapped_column(String(255), index=True)
    candidate_key: Mapped[str] = mapped_column(String(600), unique=True, index=True)
    article_path: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    usefulness_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    seo_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    geo_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    human_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    brand_fit_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    safety_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    verdict: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_winner: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PublicationExperiment(Base):
    """External publication and ranking experiment record."""

    __tablename__ = "publication_experiments"

    id: Mapped[int] = mapped_column(primary_key=True)
    project: Mapped[str] = mapped_column(String(255), index=True)
    content_title: Mapped[str] = mapped_column(String(500))
    source_artifact_path: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    platform: Mapped[str] = mapped_column(String(100), index=True)
    status: Mapped[str] = mapped_column(String(50), default="planned", index=True)
    published_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    canonical_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    search_property: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    index_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    rank_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    target_query: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    device: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    baseline_rank: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    latest_rank: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    payload_format: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    payload_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tags_csv: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PromptAssetProfile(Base):
    """Persistent lifecycle metadata for prompt assets."""

    __tablename__ = "prompt_asset_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    asset_key: Mapped[str] = mapped_column(String(600), unique=True, index=True)
    project: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    label: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="draft", index=True)
    tier: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    tags_csv: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    default_for_project: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    linked_test_case_slug: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PromptTestCaseProfile(Base):
    """Persistent lifecycle metadata for reusable test cases."""

    __tablename__ = "prompt_test_case_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    project: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    title: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="active", index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    priority: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    tags_csv: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    target_model: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
