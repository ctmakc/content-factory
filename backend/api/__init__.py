"""API routers for content factory."""
from backend.api.research import router as research_router
from backend.api.content import router as content_router
from backend.api.distribution import router as distribution_router
from backend.api.experiments import router as experiments_router
from backend.api.ops import router as ops_router
from backend.api.promptlab import router as promptlab_router
from backend.api.workspace import router as workspace_router

__all__ = ["research_router", "content_router", "distribution_router", "experiments_router", "ops_router", "promptlab_router", "workspace_router"]
