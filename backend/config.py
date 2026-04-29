"""
Configuration settings for Content Factory.
Uses pydantic-settings to load from environment variables.
"""
from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Application
    app_name: str = "Content Factory"
    debug: bool = False

    # Database
    database_url: str = "sqlite+aiosqlite:///./content_factory.db"

    # AI Provider (gemini, anthropic, or openai)
    # Priority: gemini (free tier) -> anthropic (fallback)
    ai_provider: Literal["gemini", "anthropic", "openai"] = "gemini"
    ai_fallback_provider: Literal["anthropic", "openai", ""] = "anthropic"

    # Google Gemini (primary - has free tier)
    gemini_api_key: str = ""
    gemini_model: str = "gemini-1.5-flash"

    # Anthropic (fallback)
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-3-haiku-20240307"

    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    # Social Media Credentials (encrypted in production)
    linkedin_client_id: str = ""
    linkedin_client_secret: str = ""
    twitter_api_key: str = ""
    twitter_api_secret: str = ""

    # Default settings for Crystal Tax use case
    default_niche: str = "offshore company registration"
    default_tone: str = "professional, trustworthy, educational"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
