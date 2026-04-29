"""
Writer Agent - Generates content adapted for different platforms.
"""
import json
from dataclasses import dataclass
from typing import Any, Optional

import httpx

from backend.config import get_settings
from backend.models import Platform


@dataclass
class ContentResult:
    """Generated content result."""

    title: str
    raw_content: str
    platform_versions: dict[str, str]


class WriterAgent:
    """AI-powered content writer agent."""

    def __init__(self):
        self.settings = get_settings()

    async def generate_content(
        self,
        topic: str,
        content_type: str = "social_post",
        research_context: Optional[dict[str, Any]] = None,
        platforms: Optional[list[str]] = None,
    ) -> ContentResult:
        """
        Generate content for a topic, adapted for multiple platforms.

        Args:
            topic: The content topic
            content_type: Type of content (article, social_post, etc.)
            research_context: Market research data to inform content
            platforms: List of platforms to adapt content for

        Returns:
            ContentResult with raw content and platform-specific versions
        """
        if platforms is None:
            platforms = [Platform.LINKEDIN.value, Platform.TWITTER.value]

        prompt = self._build_content_prompt(topic, content_type, research_context, platforms)

        if self.settings.ai_provider == "gemini":
            response = await self._call_gemini(prompt)
        elif self.settings.ai_provider == "anthropic":
            response = await self._call_anthropic(prompt)
        else:
            response = await self._call_openai(prompt)

        return self._parse_content_response(response)

    def _build_content_prompt(
        self,
        topic: str,
        content_type: str,
        research_context: Optional[dict[str, Any]],
        platforms: list[str],
    ) -> str:
        """Build the content generation prompt."""
        research_info = ""
        if research_context:
            research_info = f"""
MARKET RESEARCH CONTEXT:
- Target Audience: {json.dumps(research_context.get('target_audience', []), indent=2)}
- Content Angles: {json.dumps(research_context.get('content_angles', []), indent=2)}
"""

        platform_instructions = self._get_platform_instructions(platforms)

        return f"""You are an expert content writer specializing in B2B professional services.

Create {content_type} content about the following topic:

TOPIC: {topic}
TONE: {self.settings.default_tone}
{research_info}

PLATFORM REQUIREMENTS:
{platform_instructions}

Provide your content in the following JSON format:
{{
    "title": "Compelling title for the content",
    "raw_content": "The main content piece (2-3 paragraphs for articles, shorter for posts)",
    "platform_versions": {{
        "linkedin": "Professional version for LinkedIn (can be longer, more detailed)",
        "twitter": "Concise version for Twitter (under 280 characters)",
        "instagram": "Visual-friendly caption with relevant hashtags"
    }}
}}

Guidelines:
- Be educational and provide value
- Use clear, professional language
- Include a call-to-action where appropriate
- Avoid salesy or pushy language
- Focus on helping the reader understand complex topics

Return ONLY valid JSON, no additional text."""

    def _get_platform_instructions(self, platforms: list[str]) -> str:
        """Get specific instructions for each platform."""
        instructions = []

        platform_guides = {
            "linkedin": "- LinkedIn: Professional tone, can be 1300+ characters, use line breaks for readability, end with engagement question",
            "twitter": "- Twitter: Under 280 characters, punchy and engaging, use 1-2 relevant hashtags",
            "instagram": "- Instagram: Conversational, include 5-10 relevant hashtags, emoji-friendly but professional",
            "youtube": "- YouTube: Script format with hook, main content, and call-to-action",
            "facebook": "- Facebook: Conversational, 1-2 paragraphs, encourage comments",
        }

        for platform in platforms:
            if platform.lower() in platform_guides:
                instructions.append(platform_guides[platform.lower()])

        return "\n".join(instructions) if instructions else "General social media best practices"

    async def _call_gemini(self, prompt: str) -> str:
        """Call Google Gemini API."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{self.settings.gemini_model}:generateContent",
                params={"key": self.settings.gemini_api_key},
                headers={"Content-Type": "application/json"},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.8,
                        "maxOutputTokens": 2000,
                    },
                },
                timeout=60.0,
            )
            response.raise_for_status()
            data = response.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]

    async def _call_openai(self, prompt: str) -> str:
        """Call OpenAI API."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.settings.openai_model,
                    "messages": [
                        {"role": "system", "content": "You are an expert content writer. Always respond with valid JSON."},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.8,
                    "max_tokens": 2000,
                },
                timeout=60.0,
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]

    async def _call_anthropic(self, prompt: str) -> str:
        """Call Anthropic API."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": self.settings.anthropic_api_key,
                    "Content-Type": "application/json",
                    "anthropic-version": "2023-06-01",
                },
                json={
                    "model": self.settings.anthropic_model,
                    "max_tokens": 2000,
                    "messages": [
                        {"role": "user", "content": prompt},
                    ],
                },
                timeout=60.0,
            )
            response.raise_for_status()
            data = response.json()
            return data["content"][0]["text"]

    def _parse_content_response(self, response: str) -> ContentResult:
        """Parse AI response into ContentResult."""
        # Clean up response
        clean_response = response.strip()
        if clean_response.startswith("```"):
            clean_response = clean_response.split("```")[1]
            if clean_response.startswith("json"):
                clean_response = clean_response[4:]
        clean_response = clean_response.strip()

        try:
            data = json.loads(clean_response)
        except json.JSONDecodeError:
            # Return raw response if parsing fails
            return ContentResult(
                title="Generated Content",
                raw_content=response,
                platform_versions={},
            )

        return ContentResult(
            title=data.get("title", "Generated Content"),
            raw_content=data.get("raw_content", ""),
            platform_versions=data.get("platform_versions", {}),
        )
