"""
Prompt lab API: lifecycle management for prompt assets and reusable test cases.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import PromptAssetProfile, PromptBattleEvaluation, PromptTestCaseProfile
from backend.qwen_ops import qwen_create_prompt_battle, qwen_prompt_registry, qwen_read_file, qwen_save_prompt, qwen_test_cases


router = APIRouter(prefix="/promptlab", tags=["promptlab"])


class PromptAssetProfileUpsert(BaseModel):
    asset_key: str
    project: str | None = None
    label: str | None = None
    status: str = "draft"
    tier: str | None = None
    tags_csv: str | None = None
    notes: str | None = None
    default_for_project: bool = False
    linked_test_case_slug: str | None = None


class PromptTestCaseProfileUpsert(BaseModel):
    slug: str
    project: str | None = None
    title: str | None = None
    status: str = "active"
    notes: str | None = None
    priority: str | None = None
    tags_csv: str | None = None
    target_model: str | None = None


class PromptActivationRequest(BaseModel):
    asset_key: str
    target_prompt_name: str = "seo_article_system.txt"


class PromptBattleLaunchRequest(BaseModel):
    test_case_slug: str
    asset_keys: list[str]
    model: str | None = None
    slug_hint: str | None = None
    auto_start: bool = True


def profile_to_dict(row: PromptAssetProfile) -> dict[str, Any]:
    return {
        "id": row.id,
        "asset_key": row.asset_key,
        "project": row.project,
        "label": row.label,
        "status": row.status,
        "tier": row.tier,
        "tags_csv": row.tags_csv,
        "notes": row.notes,
        "default_for_project": row.default_for_project,
        "linked_test_case_slug": row.linked_test_case_slug,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def case_profile_to_dict(row: PromptTestCaseProfile) -> dict[str, Any]:
    return {
        "id": row.id,
        "slug": row.slug,
        "project": row.project,
        "title": row.title,
        "status": row.status,
        "notes": row.notes,
        "priority": row.priority,
        "tags_csv": row.tags_csv,
        "target_model": row.target_model,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _candidate_key(asset: dict[str, Any]) -> str | None:
    battle_slug = asset.get("battle_slug")
    candidate_name = asset.get("candidate_name")
    if battle_slug and candidate_name:
        return f"{battle_slug}:{candidate_name}"
    return None


def _registry_map() -> dict[str, dict[str, Any]]:
    return {item["key"]: item for item in qwen_prompt_registry()}


def _evaluation_score(row: PromptBattleEvaluation) -> float | None:
    vals = [
        row.usefulness_score,
        row.seo_score,
        row.geo_score,
        row.human_score,
        row.brand_fit_score,
        row.safety_score,
    ]
    nums = [v for v in vals if v is not None]
    if not nums:
        return None
    return round(sum(nums) / len(nums), 2)


@router.get("/assets")
async def get_prompt_assets(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    assets = list(_registry_map().values())
    profile_result = await db.execute(select(PromptAssetProfile))
    profiles = {row.asset_key: profile_to_dict(row) for row in profile_result.scalars().all()}

    eval_result = await db.execute(select(PromptBattleEvaluation))
    evals = {}
    for row in eval_result.scalars().all():
        evals[f"{row.battle_slug}:{row.candidate_name}"] = {
            "verdict": row.verdict,
            "overall_score": (
                round(
                    sum(v for v in [
                        row.usefulness_score,
                        row.seo_score,
                        row.geo_score,
                        row.human_score,
                        row.brand_fit_score,
                        row.safety_score,
                    ] if v is not None) /
                    max(1, len([v for v in [
                        row.usefulness_score,
                        row.seo_score,
                        row.geo_score,
                        row.human_score,
                        row.brand_fit_score,
                        row.safety_score,
                    ] if v is not None])),
                    2,
                )
                if any(v is not None for v in [
                    row.usefulness_score,
                    row.seo_score,
                    row.geo_score,
                    row.human_score,
                    row.brand_fit_score,
                    row.safety_score,
                ])
                else None
            ),
            "is_winner": row.is_winner,
        }

    items = []
    for asset in assets:
        key = asset["key"]
        candidate_eval = evals.get(_candidate_key(asset) or "")
        items.append(
            {
                **asset,
                "profile": profiles.get(key),
                "evaluation": candidate_eval,
            }
        )
    return {"items": items}


@router.get("/defaults")
async def get_prompt_defaults(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    assets = _registry_map()
    result = await db.execute(
        select(PromptAssetProfile).where(PromptAssetProfile.default_for_project == True)  # noqa: E712
    )
    items = []
    for profile in result.scalars().all():
        asset = assets.get(profile.asset_key)
        if not asset:
            continue
        items.append(
            {
                "asset": asset,
                "profile": profile_to_dict(profile),
            }
        )
    return {"items": items}


@router.get("/leaderboard")
async def get_prompt_leaderboard(project: str | None = None, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    registry = _registry_map()
    profile_result = await db.execute(select(PromptAssetProfile))
    profiles = {row.asset_key: row for row in profile_result.scalars().all()}
    case_profile_result = await db.execute(select(PromptTestCaseProfile))
    case_profiles = {row.slug: row for row in case_profile_result.scalars().all()}

    eval_result = await db.execute(select(PromptBattleEvaluation))
    groups: dict[str, dict[str, Any]] = {}

    for row in eval_result.scalars().all():
        asset_key = f"{row.battle_slug}:{row.candidate_name}:user_prompt"
        asset = registry.get(asset_key)
        profile = profiles.get(asset_key)
        linked_case_profile = case_profiles.get(row.battle_slug)
        asset_project = profile.project if profile and profile.project else (linked_case_profile.project if linked_case_profile else None)
        if project and asset_project != project:
            continue

        group = groups.setdefault(
            asset_key,
            {
                "asset_key": asset_key,
                "asset": asset,
                "profile": profile_to_dict(profile) if profile else None,
                "project": asset_project,
                "candidate_name": row.candidate_name,
                "battle_count": 0,
                "winner_count": 0,
                "scores": [],
                "verdicts": {},
                "battle_slugs": [],
            },
        )
        group["battle_count"] += 1
        if row.is_winner:
            group["winner_count"] += 1
        score = _evaluation_score(row)
        if score is not None:
            group["scores"].append(score)
        if row.verdict:
            group["verdicts"][row.verdict] = group["verdicts"].get(row.verdict, 0) + 1
        if row.battle_slug not in group["battle_slugs"]:
            group["battle_slugs"].append(row.battle_slug)

    items = []
    for data in groups.values():
        avg_score = round(sum(data["scores"]) / len(data["scores"]), 2) if data["scores"] else None
        items.append(
            {
                "asset_key": data["asset_key"],
                "asset": data["asset"],
                "profile": data["profile"],
                "project": data["project"],
                "candidate_name": data["candidate_name"],
                "battle_count": data["battle_count"],
                "winner_count": data["winner_count"],
                "average_score": avg_score,
                "verdicts": data["verdicts"],
                "battle_slugs": data["battle_slugs"],
            }
        )

    items.sort(
        key=lambda item: (
            item["average_score"] is not None,
            item["average_score"] or 0,
            item["winner_count"],
            item["battle_count"],
        ),
        reverse=True,
    )
    return {"items": items}


@router.post("/assets")
async def upsert_prompt_asset(payload: PromptAssetProfileUpsert, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    result = await db.execute(select(PromptAssetProfile).where(PromptAssetProfile.asset_key == payload.asset_key))
    row = result.scalar_one_or_none()
    if row is None:
        row = PromptAssetProfile(asset_key=payload.asset_key)
        db.add(row)

    if payload.default_for_project and payload.project:
        defaults = await db.execute(
            select(PromptAssetProfile).where(
                PromptAssetProfile.project == payload.project,
                PromptAssetProfile.asset_key != payload.asset_key,
                PromptAssetProfile.default_for_project == True,  # noqa: E712
            )
        )
        for other in defaults.scalars().all():
            other.default_for_project = False

    row.project = payload.project
    row.label = payload.label
    row.status = payload.status
    row.tier = payload.tier
    row.tags_csv = payload.tags_csv
    row.notes = payload.notes
    row.default_for_project = payload.default_for_project
    row.linked_test_case_slug = payload.linked_test_case_slug

    await db.flush()
    await db.refresh(row)
    return profile_to_dict(row)


@router.post("/activate")
async def activate_prompt_asset(payload: PromptActivationRequest) -> dict[str, Any]:
    asset = _registry_map().get(payload.asset_key)
    if not asset:
        return {"detail": "Prompt asset not found"}
    text = qwen_read_file(asset["path"])["text"]
    qwen_save_prompt(payload.target_prompt_name, text)
    return {
        "status": "ok",
        "asset_key": payload.asset_key,
        "asset_path": asset["path"],
        "target_prompt_name": payload.target_prompt_name,
    }


@router.post("/launch-battle")
async def launch_battle_from_test_case(payload: PromptBattleLaunchRequest) -> dict[str, Any]:
    test_cases = {item["slug"]: item for item in qwen_test_cases()}
    test_case = test_cases.get(payload.test_case_slug)
    if not test_case:
        return {"detail": "Test case not found"}
    model = payload.model or test_case.get("model") or "qwen2.5:14b"
    return qwen_create_prompt_battle(
        topic=test_case["topic"],
        language=test_case["language"],
        model=model,
        asset_keys=payload.asset_keys,
        battle_type="dataset-driven prompt battle",
        slug_hint=payload.slug_hint or payload.test_case_slug,
        auto_start=payload.auto_start,
    )


@router.get("/test-cases")
async def get_prompt_test_cases(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    cases = qwen_test_cases()
    profile_result = await db.execute(select(PromptTestCaseProfile))
    profiles = {row.slug: case_profile_to_dict(row) for row in profile_result.scalars().all()}
    return {"items": [{**item, "profile": profiles.get(item["slug"])} for item in cases]}


@router.post("/test-cases")
async def upsert_prompt_test_case(payload: PromptTestCaseProfileUpsert, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    result = await db.execute(select(PromptTestCaseProfile).where(PromptTestCaseProfile.slug == payload.slug))
    row = result.scalar_one_or_none()
    if row is None:
        row = PromptTestCaseProfile(slug=payload.slug)
        db.add(row)

    row.project = payload.project
    row.title = payload.title
    row.status = payload.status
    row.notes = payload.notes
    row.priority = payload.priority
    row.tags_csv = payload.tags_csv
    row.target_model = payload.target_model

    await db.flush()
    await db.refresh(row)
    return case_profile_to_dict(row)
