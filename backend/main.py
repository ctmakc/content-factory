"""
Content Factory - FastAPI Application Entry Point.

Marketing automation pipeline: Research → Content → Post
"""
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api import content_router, distribution_router, research_router
from backend.api.settings import router as settings_router
from backend.config import get_settings
from backend.database import close_db, init_db

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan - startup and shutdown events."""
    # Startup
    await init_db()
    yield
    # Shutdown
    await close_db()


app = FastAPI(
    title=settings.app_name,
    description="""
    Content Factory - Marketing Automation Pipeline

    A complete pipeline for:
    - **Research**: AI-powered market and audience analysis
    - **Content**: Generate platform-optimized content
    - **Distribution**: Schedule and post to social media

    Built for Crystal Tax and similar B2B professional services.
    """,
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware for frontend (allow all localhost for dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins in dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(research_router, prefix="/api")
app.include_router(content_router, prefix="/api")
app.include_router(distribution_router, prefix="/api")
app.include_router(settings_router, prefix="/api")


@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint with API info."""
    return {
        "name": settings.app_name,
        "version": "0.1.0",
        "docs": "/docs",
        "openapi": "/openapi.json",
    }


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "healthy"}


@app.get("/api")
async def api_info() -> dict[str, list[str]]:
    """API overview with available endpoints."""
    return {
        "endpoints": [
            "/api/research/campaigns - Manage marketing campaigns",
            "/api/research/analyze - Run AI market research",
            "/api/content/generate - Generate AI content",
            "/api/distribution/schedule - Schedule posts",
            "/api/distribution/post - Post immediately",
        ]
    }
