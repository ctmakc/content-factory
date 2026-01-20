"""API routers for content factory."""
from backend.api.research import router as research_router
from backend.api.content import router as content_router
from backend.api.distribution import router as distribution_router

__all__ = ["research_router", "content_router", "distribution_router"]
