"""
Poster Agent - Handles social media posting.
For MVP, this provides manual posting with platform-specific formatting.
"""
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional

import httpx

from backend.config import get_settings
from backend.models import Platform, PostStatus


@dataclass
class PostResult:
    """Result of a posting attempt."""

    success: bool
    platform: str
    external_id: Optional[str] = None
    posted_at: Optional[datetime] = None
    error_message: Optional[str] = None
    metrics: Optional[dict[str, Any]] = None


class PosterAgent:
    """
    Social media posting agent.

    For MVP, this primarily formats content and provides manual posting guidance.
    Full automation can be added later with proper OAuth flows.
    """

    def __init__(self):
        self.settings = get_settings()

    async def post_to_platform(
        self,
        platform: str,
        content: str,
        account_credentials: Optional[dict[str, str]] = None,
    ) -> PostResult:
        """
        Post content to a social media platform.

        For MVP without full OAuth, returns formatted content for manual posting.

        Args:
            platform: Target platform
            content: Content to post
            account_credentials: OAuth tokens (optional for MVP)

        Returns:
            PostResult with status and details
        """
        platform = platform.lower()

        if platform == Platform.LINKEDIN.value:
            return await self._post_to_linkedin(content, account_credentials)
        elif platform == Platform.TWITTER.value:
            return await self._post_to_twitter(content, account_credentials)
        else:
            return PostResult(
                success=False,
                platform=platform,
                error_message=f"Platform {platform} not yet supported",
            )

    async def _post_to_linkedin(
        self,
        content: str,
        credentials: Optional[dict[str, str]] = None,
    ) -> PostResult:
        """
        Post to LinkedIn.

        For full automation, implement LinkedIn API:
        https://docs.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/share-api
        """
        if not credentials or not credentials.get("access_token"):
            # Return content formatted for manual posting
            return PostResult(
                success=True,
                platform=Platform.LINKEDIN.value,
                error_message="Manual posting required - copy content above to LinkedIn",
            )

        # Full LinkedIn API implementation would go here
        try:
            async with httpx.AsyncClient() as client:
                # This is a simplified example - full implementation needs user URN
                response = await client.post(
                    "https://api.linkedin.com/v2/ugcPosts",
                    headers={
                        "Authorization": f"Bearer {credentials['access_token']}",
                        "Content-Type": "application/json",
                        "X-Restli-Protocol-Version": "2.0.0",
                    },
                    json={
                        "author": f"urn:li:person:{credentials.get('user_id', '')}",
                        "lifecycleState": "PUBLISHED",
                        "specificContent": {
                            "com.linkedin.ugc.ShareContent": {
                                "shareCommentary": {"text": content},
                                "shareMediaCategory": "NONE",
                            }
                        },
                        "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
                    },
                    timeout=30.0,
                )
                response.raise_for_status()
                data = response.json()
                return PostResult(
                    success=True,
                    platform=Platform.LINKEDIN.value,
                    external_id=data.get("id"),
                    posted_at=datetime.utcnow(),
                )
        except httpx.HTTPError as e:
            return PostResult(
                success=False,
                platform=Platform.LINKEDIN.value,
                error_message=str(e),
            )

    async def _post_to_twitter(
        self,
        content: str,
        credentials: Optional[dict[str, str]] = None,
    ) -> PostResult:
        """
        Post to Twitter/X.

        For full automation, implement Twitter API v2:
        https://developer.twitter.com/en/docs/twitter-api/tweets/manage-tweets/api-reference/post-tweets
        """
        if not credentials or not credentials.get("bearer_token"):
            return PostResult(
                success=True,
                platform=Platform.TWITTER.value,
                error_message="Manual posting required - copy content above to Twitter",
            )

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.twitter.com/2/tweets",
                    headers={
                        "Authorization": f"Bearer {credentials['bearer_token']}",
                        "Content-Type": "application/json",
                    },
                    json={"text": content},
                    timeout=30.0,
                )
                response.raise_for_status()
                data = response.json()
                return PostResult(
                    success=True,
                    platform=Platform.TWITTER.value,
                    external_id=data.get("data", {}).get("id"),
                    posted_at=datetime.utcnow(),
                )
        except httpx.HTTPError as e:
            return PostResult(
                success=False,
                platform=Platform.TWITTER.value,
                error_message=str(e),
            )

    def format_for_platform(self, platform: str, content: str) -> str:
        """
        Format content optimally for a specific platform.

        Args:
            platform: Target platform
            content: Raw content

        Returns:
            Platform-optimized content
        """
        platform = platform.lower()

        if platform == Platform.TWITTER.value:
            # Ensure under 280 characters
            if len(content) > 280:
                content = content[:277] + "..."
            return content

        elif platform == Platform.LINKEDIN.value:
            # Add line breaks for readability
            # LinkedIn supports up to 3000 characters
            return content[:3000]

        elif platform == Platform.INSTAGRAM.value:
            # Instagram captions can be up to 2200 characters
            return content[:2200]

        return content

    async def get_post_metrics(
        self,
        platform: str,
        post_id: str,
        credentials: dict[str, str],
    ) -> dict[str, Any]:
        """
        Fetch metrics for a posted content.

        Args:
            platform: The platform
            post_id: External post ID
            credentials: API credentials

        Returns:
            Dictionary of metrics (likes, shares, comments, etc.)
        """
        # Placeholder for metrics fetching
        # Implement platform-specific API calls for analytics
        return {
            "likes": 0,
            "shares": 0,
            "comments": 0,
            "impressions": 0,
            "fetched_at": datetime.utcnow().isoformat(),
        }
