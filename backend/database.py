"""
Database configuration with SQLAlchemy async support.
"""
from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from backend.config import get_settings

settings = get_settings()

# Create async engine
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
)

# Session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all database models."""

    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency to get database session."""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """Initialize database tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _apply_sqlite_migrations(conn)


async def _apply_sqlite_migrations(conn) -> None:
    """Apply lightweight additive migrations for the local SQLite dev DB."""
    if not settings.database_url.startswith("sqlite"):
        return

    result = await conn.execute(text("PRAGMA table_info(publication_experiments)"))
    columns = {row[1] for row in result.fetchall()}
    additive_columns = {
        "payload_format": "TEXT",
        "payload_json": "TEXT",
        "tags_csv": "TEXT",
    }
    for name, sql_type in additive_columns.items():
        if name not in columns:
            await conn.execute(text(f"ALTER TABLE publication_experiments ADD COLUMN {name} {sql_type}"))


async def close_db() -> None:
    """Close database connections."""
    await engine.dispose()
