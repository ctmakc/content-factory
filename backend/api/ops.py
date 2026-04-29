"""
Operations API for local QWEN control, outputs, and prompt battles.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import PromptBattleEvaluation
from backend.qwen_ops import (
    prompt_battle_detail,
    prompt_battles,
    start_prompt_battle,
    qwen_action,
    qwen_catalog,
    qwen_logs,
    qwen_launch_run,
    qwen_outputs,
    qwen_prompt_registry,
    qwen_prompt,
    qwen_queue,
    qwen_read_file,
    qwen_runtime,
    qwen_save_prompt,
    qwen_save_runtime,
    qwen_status,
    qwen_test_cases,
)


router = APIRouter(prefix="/ops", tags=["ops"])


class RuntimeUpdate(BaseModel):
    model: str | None = None
    queue_path: str | None = None
    output_root: str | None = None
    limit: int | None = None
    offset: int | None = None


class PromptUpdate(BaseModel):
    name: str = "seo_article_system.txt"
    text: str


class ActionRequest(BaseModel):
    action: str


class LaunchRequest(BaseModel):
    model: str | None = None
    queue_path: str | None = None
    output_root: str | None = None
    limit: int | None = None
    offset: int | None = None
    stop_existing: bool = True


class BattleEvaluationUpsert(BaseModel):
    battle_slug: str
    candidate_name: str
    article_path: str | None = None
    usefulness_score: int | None = None
    seo_score: int | None = None
    geo_score: int | None = None
    human_score: int | None = None
    brand_fit_score: int | None = None
    safety_score: int | None = None
    verdict: str | None = None
    notes: str | None = None
    is_winner: bool = False


def evaluation_to_dict(row: PromptBattleEvaluation) -> dict[str, Any]:
    return {
        "id": row.id,
        "battle_slug": row.battle_slug,
        "candidate_name": row.candidate_name,
        "candidate_key": row.candidate_key,
        "article_path": row.article_path,
        "usefulness_score": row.usefulness_score,
        "seo_score": row.seo_score,
        "geo_score": row.geo_score,
        "human_score": row.human_score,
        "brand_fit_score": row.brand_fit_score,
        "safety_score": row.safety_score,
        "verdict": row.verdict,
        "notes": row.notes,
        "is_winner": row.is_winner,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def evaluation_overall(item: dict[str, Any]) -> float | None:
    keys = [
        "usefulness_score",
        "seo_score",
        "geo_score",
        "human_score",
        "brand_fit_score",
        "safety_score",
    ]
    vals = [item.get(key) for key in keys if item.get(key) is not None]
    if not vals:
        return None
    return round(sum(vals) / len(vals), 2)


@router.get("/status")
async def get_ops_status() -> dict[str, Any]:
    return qwen_status()


@router.get("/runtime")
async def get_runtime() -> dict[str, Any]:
    return qwen_runtime()


@router.get("/catalog")
async def get_catalog() -> dict[str, Any]:
    return qwen_catalog()


@router.get("/prompt-registry")
async def get_prompt_registry() -> dict[str, Any]:
    return {"items": qwen_prompt_registry()}


@router.get("/test-cases")
async def get_test_cases() -> dict[str, Any]:
    return {"items": qwen_test_cases()}


@router.post("/runtime")
async def update_runtime(payload: RuntimeUpdate) -> dict[str, Any]:
    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    return qwen_save_runtime(data)


@router.get("/prompt")
async def get_prompt(name: str = Query(default="seo_article_system.txt")) -> dict[str, str]:
    return qwen_prompt(name)


@router.post("/prompt")
async def save_prompt(payload: PromptUpdate) -> dict[str, str]:
    return qwen_save_prompt(payload.name, payload.text)


@router.post("/action")
async def run_action(payload: ActionRequest) -> dict[str, Any]:
    try:
        return qwen_action(payload.action)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/launch")
async def launch_run(payload: LaunchRequest) -> dict[str, Any]:
    try:
        return qwen_launch_run(payload.model_dump())
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/queue")
async def get_queue(limit: int = Query(default=100, ge=1, le=1000)) -> dict[str, Any]:
    return {"items": qwen_queue(limit)}


@router.get("/outputs")
async def get_outputs(
    limit: int = Query(default=100, ge=1, le=1000),
    root: str | None = None,
) -> dict[str, Any]:
    return {"items": qwen_outputs(root=root, limit=limit)}


@router.get("/logs")
async def get_logs(
    name: str = Query(default="nightly-service.log"),
    max_chars: int = Query(default=20000, ge=1000, le=200000),
) -> dict[str, str]:
    return qwen_logs(name, max_chars=max_chars)


@router.get("/file")
async def get_file(path: str) -> dict[str, str]:
    try:
        return qwen_read_file(path)
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/battles")
async def get_battles() -> dict[str, Any]:
    return {"items": prompt_battles()}


@router.get("/battles/{slug}")
async def get_battle(slug: str, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    try:
        detail = prompt_battle_detail(slug)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    result = await db.execute(select(PromptBattleEvaluation).where(PromptBattleEvaluation.battle_slug == slug))
    evaluations = {row.candidate_name: evaluation_to_dict(row) for row in result.scalars().all()}
    for candidate in detail.get("candidates", []):
        candidate_eval = evaluations.get(candidate["name"])
        if candidate_eval:
            candidate_eval["overall_score"] = evaluation_overall(candidate_eval)
        candidate["evaluation"] = candidate_eval

    detail["evaluation_summary"] = {
        "count": len(evaluations),
        "winners": sum(1 for item in evaluations.values() if item.get("is_winner")),
        "verdicts": {},
        "ranking": [],
    }
    for item in evaluations.values():
        verdict = item.get("verdict")
        if verdict:
            detail["evaluation_summary"]["verdicts"][verdict] = detail["evaluation_summary"]["verdicts"].get(verdict, 0) + 1
    detail["evaluation_summary"]["ranking"] = sorted(
        [
            {
                "candidate_name": item["candidate_name"],
                "overall_score": evaluation_overall(item),
                "verdict": item.get("verdict"),
                "is_winner": item.get("is_winner", False),
            }
            for item in evaluations.values()
        ],
        key=lambda row: (row["overall_score"] is not None, row["overall_score"] or 0),
        reverse=True,
    )
    return detail


@router.post("/battles/{slug}/start")
async def start_battle(slug: str) -> dict[str, Any]:
    try:
        return start_prompt_battle(slug)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/battles/{slug}/evaluations")
async def get_battle_evaluations(slug: str, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    result = await db.execute(
        select(PromptBattleEvaluation)
        .where(PromptBattleEvaluation.battle_slug == slug)
        .order_by(PromptBattleEvaluation.updated_at.desc())
    )
    return {"items": [evaluation_to_dict(row) for row in result.scalars().all()]}


@router.post("/battles/{slug}/evaluations")
async def upsert_battle_evaluation(
    slug: str,
    payload: BattleEvaluationUpsert,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    if payload.battle_slug != slug:
        raise HTTPException(status_code=400, detail="Battle slug mismatch")

    candidate_key = f"{slug}:{payload.candidate_name}"
    result = await db.execute(select(PromptBattleEvaluation).where(PromptBattleEvaluation.candidate_key == candidate_key))
    row = result.scalar_one_or_none()
    if row is None:
        row = PromptBattleEvaluation(
            battle_slug=slug,
            candidate_name=payload.candidate_name,
            candidate_key=candidate_key,
        )
        db.add(row)

    if payload.is_winner:
        existing_winners = await db.execute(
            select(PromptBattleEvaluation).where(
                PromptBattleEvaluation.battle_slug == slug,
                PromptBattleEvaluation.candidate_key != candidate_key,
                PromptBattleEvaluation.is_winner == True,  # noqa: E712
            )
        )
        for winner in existing_winners.scalars().all():
            winner.is_winner = False

    row.article_path = payload.article_path
    row.usefulness_score = payload.usefulness_score
    row.seo_score = payload.seo_score
    row.geo_score = payload.geo_score
    row.human_score = payload.human_score
    row.brand_fit_score = payload.brand_fit_score
    row.safety_score = payload.safety_score
    row.verdict = payload.verdict
    row.notes = payload.notes
    row.is_winner = payload.is_winner

    await db.flush()
    await db.refresh(row)
    return evaluation_to_dict(row)
