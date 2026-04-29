"""
Research Agent - Analyzes markets, competitors, and audiences.
"""
import json
from dataclasses import dataclass
from typing import Any

import httpx

from backend.config import get_settings


@dataclass
class ResearchResult:
    """Research analysis result."""

    market_analysis: str
    target_audience: list[dict[str, Any]]
    competitors: list[dict[str, Any]]
    content_angles: list[str]
    platform_recommendations: list[dict[str, str]]


class ResearcherAgent:
    """AI-powered market research agent."""

    def __init__(self):
        self.settings = get_settings()

    async def analyze_niche(self, niche: str, additional_context: str = "") -> ResearchResult:
        """
        Analyze a market niche and return comprehensive research.

        Args:
            niche: The market niche to analyze (e.g., "offshore company registration")
            additional_context: Additional context about the business

        Returns:
            ResearchResult with market analysis, audience, competitors, etc.
        """
        prompt = self._build_research_prompt(niche, additional_context)

        if self.settings.ai_provider == "gemini":
            response = await self._call_gemini(prompt)
        elif self.settings.ai_provider == "anthropic":
            response = await self._call_anthropic(prompt)
        else:
            response = await self._call_openai(prompt)

        return self._parse_research_response(response)

    def _build_research_prompt(self, niche: str, additional_context: str) -> str:
        """Build the research prompt."""
        return f"""You are a market research expert specializing in B2B services marketing.

Analyze the following niche and provide comprehensive research for content marketing:

NICHE: {niche}
ADDITIONAL CONTEXT: {additional_context or "None provided"}
TONE: {self.settings.default_tone}

Provide your analysis in the following JSON format:
{{
    "market_analysis": "A comprehensive overview of the market (2-3 paragraphs)",
    "target_audience": [
        {{
            "persona_name": "Name of persona",
            "description": "Brief description",
            "pain_points": ["pain point 1", "pain point 2"],
            "goals": ["goal 1", "goal 2"],
            "preferred_content": ["content type 1", "content type 2"]
        }}
    ],
    "competitors": [
        {{
            "type": "Type of competitor",
            "positioning": "How they position themselves",
            "content_strategy": "Their content approach"
        }}
    ],
    "content_angles": [
        "Content angle 1 - specific topic ideas",
        "Content angle 2 - specific topic ideas"
    ],
    "platform_recommendations": [
        {{
            "platform": "LinkedIn",
            "reason": "Why this platform",
            "content_format": "Recommended format"
        }}
    ]
}}

Focus on actionable insights for creating educational, trustworthy content.
Return ONLY valid JSON, no additional text."""

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
                        "temperature": 0.7,
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
                        {"role": "system", "content": "You are a market research expert. Always respond with valid JSON."},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.7,
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

    def _parse_research_response(self, response: str) -> ResearchResult:
        """Parse AI response into ResearchResult."""
        # Clean up response - remove markdown code blocks if present
        clean_response = response.strip()
        if clean_response.startswith("```"):
            clean_response = clean_response.split("```")[1]
            if clean_response.startswith("json"):
                clean_response = clean_response[4:]
        clean_response = clean_response.strip()

        try:
            data = json.loads(clean_response)
        except json.JSONDecodeError:
            # Return default structure if parsing fails
            return ResearchResult(
                market_analysis=response,
                target_audience=[],
                competitors=[],
                content_angles=[],
                platform_recommendations=[],
            )

        return ResearchResult(
            market_analysis=data.get("market_analysis", ""),
            target_audience=data.get("target_audience", []),
            competitors=data.get("competitors", []),
            content_angles=data.get("content_angles", []),
            platform_recommendations=data.get("platform_recommendations", []),
        )
