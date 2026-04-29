"""
Research API endpoints.
"""
import json
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.agents.researcher import ResearcherAgent
from backend.database import get_db
from backend.models import Campaign, CampaignStatus, Research

router = APIRouter(prefix="/research", tags=["research"])


class AnalyzeRequest(BaseModel):
    """Request body for market analysis."""

    niche: str
    additional_context: Optional[str] = None
    campaign_id: Optional[int] = None


class AnalyzeResponse(BaseModel):
    """Response from market analysis."""

    research_id: int
    campaign_id: int
    market_analysis: str
    target_audience: list[dict[str, Any]]
    competitors: list[dict[str, Any]]
    content_angles: list[str]
    platform_recommendations: list[dict[str, str]]


class CampaignCreate(BaseModel):
    """Request body for creating a campaign."""

    name: str
    niche: str
    description: Optional[str] = None


class CampaignResponse(BaseModel):
    """Response for campaign data."""

    id: int
    name: str
    niche: str
    description: Optional[str]
    status: str


@router.post("/campaigns", response_model=CampaignResponse)
async def create_campaign(
    request: CampaignCreate,
    db: AsyncSession = Depends(get_db),
) -> Campaign:
    """Create a new marketing campaign."""
    campaign = Campaign(
        name=request.name,
        niche=request.niche,
        description=request.description,
        status=CampaignStatus.DRAFT.value,
    )
    db.add(campaign)
    await db.flush()
    await db.refresh(campaign)
    return campaign


@router.get("/campaigns", response_model=list[CampaignResponse])
async def list_campaigns(
    db: AsyncSession = Depends(get_db),
) -> list[Campaign]:
    """List all campaigns."""
    result = await db.execute(select(Campaign).order_by(Campaign.created_at.desc()))
    return list(result.scalars().all())


@router.get("/campaigns/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
) -> Campaign:
    """Get a specific campaign."""
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_market(
    request: AnalyzeRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Analyze a market niche using AI.

    This endpoint uses the ResearcherAgent to analyze:
    - Market overview
    - Target audience personas
    - Competitor positioning
    - Content angle recommendations
    - Platform recommendations

    If no campaign_id is provided, creates a new campaign automatically.
    """
    # Get or create campaign
    if request.campaign_id:
        result = await db.execute(
            select(Campaign).where(Campaign.id == request.campaign_id)
        )
        campaign = result.scalar_one_or_none()
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
    else:
        # Create new campaign
        campaign = Campaign(
            name=f"Research: {request.niche[:50]}",
            niche=request.niche,
            status=CampaignStatus.ACTIVE.value,
        )
        db.add(campaign)
        await db.flush()
        await db.refresh(campaign)

    # Run research
    agent = ResearcherAgent()
    try:
        result = await agent.analyze_niche(
            niche=request.niche,
            additional_context=request.additional_context or "",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Research failed: {str(e)}")

    # Save research to database
    research = Research(
        campaign_id=campaign.id,
        market_analysis=result.market_analysis,
        target_audience=json.dumps(result.target_audience),
        competitors=json.dumps(result.competitors),
        content_angles=json.dumps(result.content_angles),
        platform_recommendations=json.dumps(result.platform_recommendations),
    )
    db.add(research)
    await db.flush()
    await db.refresh(research)

    return {
        "research_id": research.id,
        "campaign_id": campaign.id,
        "market_analysis": result.market_analysis,
        "target_audience": result.target_audience,
        "competitors": result.competitors,
        "content_angles": result.content_angles,
        "platform_recommendations": result.platform_recommendations,
    }


@router.get("/campaigns/{campaign_id}/research")
async def get_campaign_research(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """Get all research for a campaign."""
    result = await db.execute(
        select(Research).where(Research.campaign_id == campaign_id)
    )
    research_list = result.scalars().all()

    return [
        {
            "id": r.id,
            "campaign_id": r.campaign_id,
            "market_analysis": r.market_analysis,
            "target_audience": json.loads(r.target_audience) if r.target_audience else [],
            "competitors": json.loads(r.competitors) if r.competitors else [],
            "content_angles": json.loads(r.content_angles) if r.content_angles else [],
            "platform_recommendations": json.loads(r.platform_recommendations) if r.platform_recommendations else [],
            "created_at": r.created_at.isoformat(),
        }
        for r in research_list
    ]
