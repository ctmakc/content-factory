"""
Workspace API for runs, generated article catalog, and saved reviews.
"""
from __future__ import annotations

import difflib
import json
from typing import Any
from pathlib import Path
import re

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import ArticleReview
from backend.qwen_ops import qwen_compare_candidates, qwen_launch_run, qwen_read_file, qwen_run_articles, qwen_runs


router = APIRouter(prefix="/workspace", tags=["workspace"])
REWRITE_QUEUE_ROOT = Path("/data/QWEN/queue/rewrite")


class ReviewUpsert(BaseModel):
    run_slug: str
    artifact_path: str
    project: str | None = None
    title: str | None = None
    usefulness_score: int | None = None
    seo_score: int | None = None
    geo_score: int | None = None
    human_score: int | None = None
    brand_fit_score: int | None = None
    safety_score: int | None = None
    verdict: str | None = None
    notes: str | None = None
    tags: list[str] | None = None


class RewriteQueueBuildRequest(BaseModel):
    run_slug: str
    project: str | None = None
    verdict: str | None = None
    auto_tier: str | None = None
    limit: int = 50
    queue_name: str | None = None


class RewriteQueueLaunchRequest(RewriteQueueBuildRequest):
    model: str | None = None
    output_root: str | None = None


def review_to_dict(row: ArticleReview) -> dict[str, Any]:
    return {
        "id": row.id,
        "run_slug": row.run_slug,
        "artifact_path": row.artifact_path,
        "project": row.project,
        "title": row.title,
        "usefulness_score": row.usefulness_score,
        "seo_score": row.seo_score,
        "geo_score": row.geo_score,
        "human_score": row.human_score,
        "brand_fit_score": row.brand_fit_score,
        "safety_score": row.safety_score,
        "verdict": row.verdict,
        "notes": row.notes,
        "tags": json.loads(row.tags_json) if row.tags_json else [],
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _attach_reviews(articles: list[dict[str, Any]], reviews: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    for article in articles:
        article["review"] = reviews.get(article["artifact_path"])
    return articles


def _paragraphs(text: str) -> list[str]:
    chunks = [part.strip() for part in text.split("\n\n")]
    return [part for part in chunks if part]


def _slugify(value: str) -> str:
    text = re.sub(r"[^\w]+", "-", value.lower(), flags=re.UNICODE).strip("-")
    return text or "item"


def _auto_quality(article: dict[str, Any], text: str) -> dict[str, Any]:
    title = article.get("title") or ""
    lowered = text.lower()
    flags: list[str] = []

    if article.get("chars", 0) < 3500:
        flags.append("short-content")
    if article.get("words", 0) < 500:
        flags.append("thin-coverage")
    if title and len(title) < 24:
        flags.append("weak-title")
    if title.count("?") > 1 or "  " in title:
        flags.append("messy-title")
    if article.get("title", "").lower().startswith(("how to choose", "what you need to know", "in today")):
        flags.append("template-title")
    if "in today's" in lowered or "in this article" in lowered or "in this guide" in lowered:
        flags.append("ai-intro-marker")
    if "if you feel that you cannot" in lowered or "recommend consulting a professional" in lowered:
        flags.append("generic-cta")
    if article.get("words", 0) > 0 and article.get("h2", 0) == 0:
        flags.append("missing-h2")
    if article.get("words", 0) > 700 and article.get("paragraphs", 0) < 6:
        flags.append("dense-wall-of-text")

    if not flags:
        tier = "healthy"
        suggested_verdict = "good-base"
    elif any(flag in flags for flag in ["messy-title", "missing-h2"]) and len(flags) >= 3:
        tier = "high-risk"
        suggested_verdict = "needs-rewrite"
    elif len(flags) >= 3:
        tier = "warning"
        suggested_verdict = "needs-rewrite"
    else:
        tier = "review"
        suggested_verdict = "salvageable"

    return {
        "flags": flags,
        "flag_count": len(flags),
        "tier": tier,
        "suggested_verdict": suggested_verdict,
    }


def _attach_auto_quality(articles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    for article in articles:
        try:
            text = qwen_read_file(article["artifact_path"])["text"]
        except FileNotFoundError:
            text = ""
        lines = text.splitlines()
        article["h2"] = sum(1 for line in lines if line.startswith("## "))
        article["paragraphs"] = len(_paragraphs(text))
        article["auto_quality"] = _auto_quality(article, text)
    return articles


def _generated_lineage_nodes() -> tuple[list[dict[str, Any]], dict[str, list[dict[str, Any]]], dict[str, dict[str, Any]]]:
    nodes: list[dict[str, Any]] = []
    children_map: dict[str, list[dict[str, Any]]] = {}
    by_artifact: dict[str, dict[str, Any]] = {}

    for run in qwen_runs():
        root = Path(run["root"])
        for meta_path in root.rglob("*.json"):
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
            except Exception:
                continue
            source_artifact_path = meta.get("source_artifact_path")
            if not source_artifact_path:
                continue
            article_path = meta_path.with_suffix(".md")
            if not article_path.exists():
                continue
            text = article_path.read_text(encoding="utf-8", errors="replace")
            node = {
                "artifact_path": str(article_path),
                "meta_path": str(meta_path),
                "source_artifact_path": str(source_artifact_path),
                "run_slug": run["slug"],
                "run_name": run["name"],
                "project": article_path.parent.name,
                "title": meta.get("title") or (text.splitlines()[0].lstrip("# ").strip() if text else article_path.stem),
                "rewrite_focus": meta.get("rewrite_focus", []),
                "updated_at": article_path.stat().st_mtime,
                "chars": len(text),
                "words": len(text.split()),
            }
            nodes.append(node)
            by_artifact[node["artifact_path"]] = node
            children_map.setdefault(node["source_artifact_path"], []).append(node)

    for key in children_map:
        children_map[key].sort(key=lambda item: item["updated_at"], reverse=True)

    return nodes, children_map, by_artifact


def _lineage_tree_for(artifact_path: str) -> dict[str, Any]:
    target = str(Path(artifact_path).resolve())
    nodes, children_map, _by_artifact = _generated_lineage_nodes()

    descendants: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []
    stack: list[tuple[str, int]] = [(target, 0)]
    seen: set[str] = set()

    while stack:
        current, depth = stack.pop()
        for child in children_map.get(current, []):
            child_path = child["artifact_path"]
            if child_path in seen:
                continue
            seen.add(child_path)
            enriched = {**child, "depth": depth + 1}
            descendants.append(enriched)
            edges.append(
                {
                    "parent_artifact_path": current,
                    "artifact_path": child_path,
                    "depth": depth + 1,
                }
            )
            stack.append((child_path, depth + 1))

    descendants.sort(key=lambda item: item["updated_at"], reverse=True)
    latest_descendant = descendants[0] if descendants else None

    return {
        "target": target,
        "children": descendants,
        "edges": edges,
        "latest_descendant": latest_descendant,
        "descendant_count": len(descendants),
        "max_depth": max((item["depth"] for item in descendants), default=0),
    }


@router.get("/runs")
async def get_runs() -> dict[str, Any]:
    return {"items": qwen_runs()}


@router.get("/runs/{slug}/articles")
async def get_run_articles(
    slug: str,
    limit: int = Query(default=200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    try:
        articles = qwen_run_articles(slug, limit=limit)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    artifact_paths = [item["artifact_path"] for item in articles]
    reviews_result = await db.execute(select(ArticleReview).where(ArticleReview.artifact_path.in_(artifact_paths)))
    reviews = {row.artifact_path: review_to_dict(row) for row in reviews_result.scalars().all()}
    return {"items": _attach_auto_quality(_attach_reviews(articles, reviews))}


@router.get("/reviews")
async def get_reviews(
    run_slug: str | None = None,
    verdict: str | None = None,
    project: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    stmt = select(ArticleReview).order_by(ArticleReview.updated_at.desc())
    if run_slug:
        stmt = stmt.where(ArticleReview.run_slug == run_slug)
    if verdict:
        stmt = stmt.where(ArticleReview.verdict == verdict)
    if project:
        stmt = stmt.where(ArticleReview.project == project)
    result = await db.execute(stmt)
    return {"items": [review_to_dict(row) for row in result.scalars().all()]}


@router.get("/inbox")
async def get_inbox(
    verdict: str | None = None,
    project: str | None = None,
    run_slug: str | None = None,
    limit: int = Query(default=200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    runs = qwen_runs()
    articles: list[dict[str, Any]] = []

    for run in runs:
        if run_slug and run["slug"] != run_slug:
            continue
        articles.extend(qwen_run_articles(run["slug"], limit=limit))
        if len(articles) >= limit * 2:
            break

    artifact_paths = [item["artifact_path"] for item in articles]
    reviews_result = await db.execute(select(ArticleReview).where(ArticleReview.artifact_path.in_(artifact_paths)))
    reviews = {row.artifact_path: review_to_dict(row) for row in reviews_result.scalars().all()}
    items = _attach_auto_quality(_attach_reviews(articles, reviews))

    filtered: list[dict[str, Any]] = []
    for item in items:
        review = item.get("review") or {}
        item_verdict = review.get("verdict")
        if project and item.get("project") != project:
            continue
        if verdict:
            if verdict == "__unreviewed__":
                if item_verdict:
                    continue
            elif item_verdict != verdict:
                continue
        filtered.append(item)

    filtered.sort(key=lambda item: item["updated_at"], reverse=True)
    return {"items": filtered[:limit]}


@router.get("/runs/{slug}/quality-gates")
async def get_run_quality_gates(
    slug: str,
    limit: int = Query(default=300, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    try:
        articles = qwen_run_articles(slug, limit=limit)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    artifact_paths = [item["artifact_path"] for item in articles]
    reviews_result = await db.execute(select(ArticleReview).where(ArticleReview.artifact_path.in_(artifact_paths)))
    reviews = {row.artifact_path: review_to_dict(row) for row in reviews_result.scalars().all()}
    items = _attach_auto_quality(_attach_reviews(articles, reviews))

    tiers = {"healthy": 0, "review": 0, "warning": 0, "high-risk": 0}
    verdict_suggestions: dict[str, int] = {}
    top_flags: dict[str, int] = {}
    for item in items:
        auto = item.get("auto_quality") or {}
        tier = auto.get("tier")
        if tier in tiers:
            tiers[tier] += 1
        suggested = auto.get("suggested_verdict")
        if suggested:
            verdict_suggestions[suggested] = verdict_suggestions.get(suggested, 0) + 1
        for flag in auto.get("flags", []):
            top_flags[flag] = top_flags.get(flag, 0) + 1

    return {
        "run_slug": slug,
        "article_count": len(items),
        "tiers": tiers,
        "suggested_verdicts": verdict_suggestions,
        "top_flags": dict(sorted(top_flags.items(), key=lambda kv: kv[1], reverse=True)[:10]),
    }


@router.post("/runs/{slug}/build-rewrite-queue")
async def build_rewrite_queue(
    slug: str,
    payload: RewriteQueueBuildRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    if payload.run_slug != slug:
        raise HTTPException(status_code=400, detail="Run slug mismatch")
    try:
        articles = qwen_run_articles(slug, limit=1000)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    artifact_paths = [item["artifact_path"] for item in articles]
    reviews_result = await db.execute(select(ArticleReview).where(ArticleReview.artifact_path.in_(artifact_paths)))
    reviews = {row.artifact_path: review_to_dict(row) for row in reviews_result.scalars().all()}
    items = _attach_auto_quality(_attach_reviews(articles, reviews))

    selected: list[dict[str, Any]] = []
    for item in items:
        if payload.project and item.get("project") != payload.project:
            continue
        review_verdict = (item.get("review") or {}).get("verdict")
        if payload.verdict:
            if payload.verdict == "__unreviewed__":
                if review_verdict:
                    continue
            elif review_verdict != payload.verdict:
                continue
        if payload.auto_tier and (item.get("auto_quality") or {}).get("tier") != payload.auto_tier:
            continue
        selected.append(item)
        if len(selected) >= payload.limit:
            break

    queue_name = payload.queue_name or f"{slug}-rewrite-{_slugify(payload.project or payload.verdict or payload.auto_tier or 'batch')}"
    queue_path = REWRITE_QUEUE_ROOT / f"{_slugify(queue_name)}.jsonl"
    queue_path.parent.mkdir(parents=True, exist_ok=True)

    lines: list[str] = []
    created_items: list[dict[str, Any]] = []
    for idx, item in enumerate(selected, start=1):
        review = item.get("review") or {}
        auto = item.get("auto_quality") or {}
        rewrite_focus = list(auto.get("flags", []))
        if review.get("notes"):
            rewrite_focus.append(f"Reviewer notes: {review['notes']}")
        payload_item = {
            "id": idx,
            "project": item.get("project"),
            "language": "Russian" if re.search(r"[А-Яа-яЁёІіЇїЄє]", item.get("title", "")) else "English",
            "title": item.get("title"),
            "primary_keyword": item.get("title", "").lower(),
            "keywords": [],
            "audience": "same audience as the original article",
            "intent": "informational",
            "brief": (
                f"Rewrite the existing article into a stronger version. "
                f"Current auto tier: {auto.get('tier')}. "
                f"Suggested verdict: {auto.get('suggested_verdict')}."
            ),
            "cta": "Keep the CTA subtle and aligned with the original project positioning.",
            "target_chars": "7000-8500 characters if supported by substance; otherwise improve depth without filler.",
            "source_artifact_path": item.get("artifact_path"),
            "rewrite_focus": rewrite_focus,
        }
        created_items.append(payload_item)
        lines.append(json.dumps(payload_item, ensure_ascii=False))

    queue_path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")
    return {
        "run_slug": slug,
        "queue_path": str(queue_path),
        "count": len(created_items),
        "items": created_items[:20],
    }


@router.post("/runs/{slug}/launch-rewrite-run")
async def launch_rewrite_run(
    slug: str,
    payload: RewriteQueueLaunchRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    built = await build_rewrite_queue(
        slug,
        RewriteQueueBuildRequest(
            run_slug=payload.run_slug,
            project=payload.project,
            verdict=payload.verdict,
            auto_tier=payload.auto_tier,
            limit=payload.limit,
            queue_name=payload.queue_name,
        ),
        db,
    )
    queue_path = built["queue_path"]
    output_root = payload.output_root or f"/data/QWEN/output_runs/{Path(queue_path).stem}"
    launch_result = qwen_launch_run(
        {
            "model": payload.model,
            "queue_path": queue_path,
            "output_root": output_root,
            "limit": payload.limit,
            "offset": 0,
            "stop_existing": True,
        }
    )
    return {
        **built,
        "output_root": output_root,
        "launch": launch_result,
    }


@router.get("/runs/{slug}/rewrite-history")
async def get_run_rewrite_history(slug: str) -> dict[str, Any]:
    try:
        source_articles = qwen_run_articles(slug, limit=1000)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    source_quality: dict[str, dict[str, Any]] = {}
    for article in source_articles:
        try:
            source_text = qwen_read_file(article["artifact_path"])["text"]
        except FileNotFoundError:
            source_text = ""
        source_enriched = dict(article)
        source_enriched["h2"] = sum(1 for line in source_text.splitlines() if line.startswith("## "))
        source_enriched["paragraphs"] = len(_paragraphs(source_text))
        source_quality[article["artifact_path"]] = _auto_quality(source_enriched, source_text)

    source_paths = {item["artifact_path"] for item in source_articles}
    nodes, _children_map, by_artifact = _generated_lineage_nodes()
    parent_map = {node["artifact_path"]: node["source_artifact_path"] for node in nodes}

    descendant_count = 0
    rewritten_roots: dict[str, int] = {}
    latest_descendant: dict[str, Any] | None = None
    latest_runs: dict[str, int] = {}
    improved_descendants = 0
    regressed_descendants = 0
    unchanged_descendants = 0
    char_deltas: list[int] = []
    word_deltas: list[int] = []

    for node in nodes:
        current = node["artifact_path"]
        root_hit: str | None = None
        while current in parent_map:
            parent = parent_map[current]
            if parent in source_paths:
                root_hit = parent
                break
            current = parent
        if not root_hit:
            continue
        descendant_count += 1
        rewritten_roots[root_hit] = rewritten_roots.get(root_hit, 0) + 1
        latest_runs[node["run_name"]] = latest_runs.get(node["run_name"], 0) + 1
        if latest_descendant is None or node["updated_at"] > latest_descendant["updated_at"]:
            latest_descendant = node

        source_article = next((item for item in source_articles if item["artifact_path"] == root_hit), None)
        if source_article:
            char_deltas.append(node["chars"] - source_article["chars"])
            word_deltas.append(node["words"] - source_article["words"])
        try:
            rewritten_text = qwen_read_file(node["artifact_path"])["text"]
        except FileNotFoundError:
            rewritten_text = ""
        rewritten_enriched = {
            "artifact_path": node["artifact_path"],
            "title": node["title"],
            "chars": node["chars"],
            "words": node["words"],
            "h2": sum(1 for line in rewritten_text.splitlines() if line.startswith("## ")),
            "paragraphs": len(_paragraphs(rewritten_text)),
        }
        rewritten_quality = _auto_quality(rewritten_enriched, rewritten_text)
        source_q = source_quality.get(root_hit, {"flag_count": 0})
        if rewritten_quality["flag_count"] < source_q.get("flag_count", 0):
            improved_descendants += 1
        elif rewritten_quality["flag_count"] > source_q.get("flag_count", 0):
            regressed_descendants += 1
        else:
            unchanged_descendants += 1

    top_rewritten = sorted(
        [
            {
                "source_artifact_path": artifact_path,
                "title": next((item["title"] for item in source_articles if item["artifact_path"] == artifact_path), Path(artifact_path).stem),
                "descendant_count": count,
                "latest_descendant": _lineage_tree_for(artifact_path)["latest_descendant"],
            }
            for artifact_path, count in rewritten_roots.items()
        ],
        key=lambda item: item["descendant_count"],
        reverse=True,
    )[:12]

    return {
        "run_slug": slug,
        "source_article_count": len(source_articles),
        "rewritten_article_count": len(rewritten_roots),
        "descendant_count": descendant_count,
        "latest_descendant": latest_descendant,
        "latest_runs": dict(sorted(latest_runs.items(), key=lambda kv: kv[1], reverse=True)[:10]),
        "effectiveness": {
            "improved_descendants": improved_descendants,
            "regressed_descendants": regressed_descendants,
            "unchanged_descendants": unchanged_descendants,
            "avg_char_delta": round(sum(char_deltas) / len(char_deltas), 1) if char_deltas else 0,
            "avg_word_delta": round(sum(word_deltas) / len(word_deltas), 1) if word_deltas else 0,
        },
        "top_rewritten": top_rewritten,
    }


@router.get("/lineage")
async def get_article_lineage(artifact_path: str) -> dict[str, Any]:
    target = Path(artifact_path).resolve()
    if not target.exists():
        raise HTTPException(status_code=404, detail="Artifact not found")
    return _lineage_tree_for(str(target))


@router.post("/reviews")
async def upsert_review(
    payload: ReviewUpsert,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    result = await db.execute(select(ArticleReview).where(ArticleReview.artifact_path == payload.artifact_path))
    row = result.scalar_one_or_none()
    if row is None:
        row = ArticleReview(
            run_slug=payload.run_slug,
            artifact_path=payload.artifact_path,
        )
        db.add(row)

    row.run_slug = payload.run_slug
    row.project = payload.project
    row.title = payload.title
    row.usefulness_score = payload.usefulness_score
    row.seo_score = payload.seo_score
    row.geo_score = payload.geo_score
    row.human_score = payload.human_score
    row.brand_fit_score = payload.brand_fit_score
    row.safety_score = payload.safety_score
    row.verdict = payload.verdict
    row.notes = payload.notes
    row.tags_json = json.dumps(payload.tags or [])

    await db.flush()
    await db.refresh(row)
    return review_to_dict(row)


@router.get("/runs/{slug}/scorecard")
async def get_run_scorecard(
    slug: str,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    result = await db.execute(select(ArticleReview).where(ArticleReview.run_slug == slug))
    rows = result.scalars().all()
    reviews = [review_to_dict(row) for row in rows]

    def avg(key: str) -> float | None:
        vals = [item[key] for item in reviews if item.get(key) is not None]
        if not vals:
            return None
        return round(sum(vals) / len(vals), 2)

    verdicts: dict[str, int] = {}
    for item in reviews:
        if item.get("verdict"):
            verdicts[item["verdict"]] = verdicts.get(item["verdict"], 0) + 1

    return {
        "run_slug": slug,
        "review_count": len(reviews),
        "averages": {
            "usefulness_score": avg("usefulness_score"),
            "seo_score": avg("seo_score"),
            "geo_score": avg("geo_score"),
            "human_score": avg("human_score"),
            "brand_fit_score": avg("brand_fit_score"),
            "safety_score": avg("safety_score"),
        },
        "verdicts": verdicts,
    }


@router.get("/runs/{slug}/review-summary")
async def get_run_review_summary(
    slug: str,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    result = await db.execute(select(ArticleReview).where(ArticleReview.run_slug == slug))
    rows = [review_to_dict(row) for row in result.scalars().all()]
    by_project: dict[str, dict[str, Any]] = {}
    for item in rows:
        project = item.get("project") or "unknown"
        bucket = by_project.setdefault(project, {"count": 0, "verdicts": {}})
        bucket["count"] += 1
        verdict = item.get("verdict")
        if verdict:
            bucket["verdicts"][verdict] = bucket["verdicts"].get(verdict, 0) + 1
    return {
        "run_slug": slug,
        "projects": by_project,
        "review_count": len(rows),
    }


@router.get("/compare")
async def get_compare_candidates(
    artifact_path: str,
    limit: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    try:
        return qwen_compare_candidates(artifact_path, limit=limit)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/diff")
async def get_article_diff(
    left_path: str,
    right_path: str,
) -> dict[str, Any]:
    try:
        left_text = qwen_read_file(left_path)["text"]
        right_text = qwen_read_file(right_path)["text"]
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    left_parts = _paragraphs(left_text)
    right_parts = _paragraphs(right_text)
    matcher = difflib.SequenceMatcher(a=left_parts, b=right_parts)
    blocks: list[dict[str, Any]] = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        blocks.append(
            {
                "tag": tag,
                "left": left_parts[i1:i2],
                "right": right_parts[j1:j2],
            }
        )

    left_only = sum(len(block["left"]) for block in blocks if block["tag"] in {"delete", "replace"})
    right_only = sum(len(block["right"]) for block in blocks if block["tag"] in {"insert", "replace"})
    equal = sum(len(block["left"]) for block in blocks if block["tag"] == "equal")

    return {
        "left_path": left_path,
        "right_path": right_path,
        "summary": {
            "left_paragraphs": len(left_parts),
            "right_paragraphs": len(right_parts),
            "equal_paragraphs": equal,
            "changed_left_paragraphs": left_only,
            "changed_right_paragraphs": right_only,
            "similarity_ratio": round(matcher.ratio(), 3),
        },
        "blocks": blocks,
    }
