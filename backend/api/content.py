"""
Content API endpoints.
"""
import json
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.agents.writer import WriterAgent
from backend.database import get_db
from backend.models import Campaign, Content, ContentType, Platform, Research

router = APIRouter(prefix="/content", tags=["content"])


class GenerateRequest(BaseModel):
    """Request body for content generation."""

    campaign_id: int
    topic: str
    content_type: str = ContentType.SOCIAL_POST.value
    platforms: Optional[list[str]] = None
    use_research: bool = True


class GenerateResponse(BaseModel):
    """Response from content generation."""

    content_id: int
    campaign_id: int
    title: str
    raw_content: str
    platform_versions: dict[str, str]


class ContentResponse(BaseModel):
    """Response for content data."""

    id: int
    campaign_id: int
    title: str
    content_type: str
    topic: Optional[str]
    raw_content: str
    platform_versions: Optional[dict[str, str]]
    created_at: str


class ContentUpdate(BaseModel):
    """Request body for updating content."""

    title: Optional[str] = None
    raw_content: Optional[str] = None
    platform_versions: Optional[dict[str, str]] = None


@router.post("/generate", response_model=GenerateResponse)
async def generate_content(
    request: GenerateRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Generate content using AI.

    This endpoint uses the WriterAgent to create content adapted
    for multiple platforms based on the topic and optional research context.
    """
    # Verify campaign exists
    result = await db.execute(
        select(Campaign).where(Campaign.id == request.campaign_id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Get research context if requested
    research_context = None
    if request.use_research:
        result = await db.execute(
            select(Research)
            .where(Research.campaign_id == request.campaign_id)
            .order_by(Research.created_at.desc())
        )
        research = result.scalar_one_or_none()
        if research:
            research_context = {
                "market_analysis": research.market_analysis,
                "target_audience": json.loads(research.target_audience) if research.target_audience else [],
                "content_angles": json.loads(research.content_angles) if research.content_angles else [],
            }

    # Set default platforms
    platforms = request.platforms or [Platform.LINKEDIN.value, Platform.TWITTER.value]

    # Generate content
    agent = WriterAgent()
    try:
        result = await agent.generate_content(
            topic=request.topic,
            content_type=request.content_type,
            research_context=research_context,
            platforms=platforms,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Content generation failed: {str(e)}")

    # Save content to database
    content = Content(
        campaign_id=campaign.id,
        title=result.title,
        content_type=request.content_type,
        topic=request.topic,
        raw_content=result.raw_content,
        platform_versions=json.dumps(result.platform_versions),
    )
    db.add(content)
    await db.flush()
    await db.refresh(content)

    return {
        "content_id": content.id,
        "campaign_id": campaign.id,
        "title": result.title,
        "raw_content": result.raw_content,
        "platform_versions": result.platform_versions,
    }


@router.get("/campaigns/{campaign_id}/content", response_model=list[ContentResponse])
async def list_campaign_content(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """List all content for a campaign."""
    result = await db.execute(
        select(Content)
        .where(Content.campaign_id == campaign_id)
        .order_by(Content.created_at.desc())
    )
    content_list = result.scalars().all()

    return [
        {
            "id": c.id,
            "campaign_id": c.campaign_id,
            "title": c.title,
            "content_type": c.content_type,
            "topic": c.topic,
            "raw_content": c.raw_content,
            "platform_versions": json.loads(c.platform_versions) if c.platform_versions else {},
            "created_at": c.created_at.isoformat(),
        }
        for c in content_list
    ]


@router.get("/{content_id}", response_model=ContentResponse)
async def get_content(
    content_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Get specific content by ID."""
    result = await db.execute(select(Content).where(Content.id == content_id))
    content = result.scalar_one_or_none()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    return {
        "id": content.id,
        "campaign_id": content.campaign_id,
        "title": content.title,
        "content_type": content.content_type,
        "topic": content.topic,
        "raw_content": content.raw_content,
        "platform_versions": json.loads(content.platform_versions) if content.platform_versions else {},
        "created_at": content.created_at.isoformat(),
    }


@router.patch("/{content_id}", response_model=ContentResponse)
async def update_content(
    content_id: int,
    request: ContentUpdate,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Update content."""
    result = await db.execute(select(Content).where(Content.id == content_id))
    content = result.scalar_one_or_none()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    if request.title is not None:
        content.title = request.title
    if request.raw_content is not None:
        content.raw_content = request.raw_content
    if request.platform_versions is not None:
        content.platform_versions = json.dumps(request.platform_versions)

    await db.flush()
    await db.refresh(content)

    return {
        "id": content.id,
        "campaign_id": content.campaign_id,
        "title": content.title,
        "content_type": content.content_type,
        "topic": content.topic,
        "raw_content": content.raw_content,
        "platform_versions": json.loads(content.platform_versions) if content.platform_versions else {},
        "created_at": content.created_at.isoformat(),
    }


@router.delete("/{content_id}")
async def delete_content(
    content_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Delete content."""
    result = await db.execute(select(Content).where(Content.id == content_id))
    content = result.scalar_one_or_none()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    await db.delete(content)
    return {"status": "deleted"}
