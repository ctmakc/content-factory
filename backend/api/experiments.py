"""
Publication experiment API for external syndication and ranking tests.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import Account, ApiKey, ArticleReview, PublicationExperiment
from backend.qwen_ops import qwen_read_file, qwen_run_articles, qwen_runs


router = APIRouter(prefix="/experiments", tags=["experiments"])
EXPORT_ROOT = Path("/data/QWEN/publish_bundles")


class ExperimentUpsert(BaseModel):
    id: int | None = None
    project: str
    content_title: str
    source_artifact_path: str | None = None
    platform: str
    status: str = "planned"
    published_url: str | None = None
    canonical_url: str | None = None
    search_property: str | None = None
    index_status: str | None = None
    rank_status: str | None = None
    target_query: str | None = None
    country: str | None = None
    device: str | None = None
    baseline_rank: str | None = None
    latest_rank: str | None = None
    payload_format: str | None = None
    payload_json: str | None = None
    tags_csv: str | None = None
    notes: str | None = None


class PayloadRequest(BaseModel):
    platform: str
    source_artifact_path: str | None = None
    content_title: str | None = None
    canonical_url: str | None = None
    published_url: str | None = None
    tags: list[str] | None = None
    prefer_latest_iteration: bool = True


class BatchPrepareRequest(BaseModel):
    run_slug: str
    platform: str
    project: str | None = None
    verdict: str | None = None
    limit: int = 20
    tags: list[str] | None = None
    prefer_latest_iteration: bool = True


class ExportBundleRequest(BaseModel):
    experiment_ids: list[int]
    label: str | None = None


def experiment_to_dict(row: PublicationExperiment) -> dict[str, Any]:
    return {
        "id": row.id,
        "project": row.project,
        "content_title": row.content_title,
        "source_artifact_path": row.source_artifact_path,
        "platform": row.platform,
        "status": row.status,
        "published_url": row.published_url,
        "canonical_url": row.canonical_url,
        "search_property": row.search_property,
        "index_status": row.index_status,
        "rank_status": row.rank_status,
        "target_query": row.target_query,
        "country": row.country,
        "device": row.device,
        "baseline_rank": row.baseline_rank,
        "latest_rank": row.latest_rank,
        "payload_format": row.payload_format,
        "payload_json": row.payload_json,
        "tags_csv": row.tags_csv,
        "notes": row.notes,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _extract_title_body(markdown: str, fallback_title: str | None = None) -> tuple[str, str]:
    lines = markdown.splitlines()
    title = fallback_title or "Untitled"
    body_lines = lines
    if lines and lines[0].startswith("# "):
        title = lines[0][2:].strip() or title
        body_lines = lines[1:]
    body = "\n".join(body_lines).strip()
    return title, body


def _platform_playbooks(accounts: list[Account], keys: list[ApiKey]) -> list[dict[str, Any]]:
    connected_accounts = {item.platform: item for item in accounts if item.is_active}
    active_keys = {item.provider: item for item in keys if item.is_active}

    items = [
        {
            "platform": "devto",
            "label": "DEV / Forem",
            "publish_mode": "api",
            "readiness": "ready" if "devto" in connected_accounts else "needs-token",
            "needs": ["social account with DEV API key"],
            "notes": "Best first automation target. Supports canonical URL and article API.",
            "can_publish": "devto" in connected_accounts,
            "steps": [
                "Add a DEV API key in Settings > Social Accounts.",
                "Prepare publication payloads or export a bundle from Experiments.",
                "Publish drafts first, then capture the resulting URL for tracking.",
                "Measure indexing and weekly rank snapshots against the target query.",
            ],
            "docs_url": "https://developers.forem.com/api/v1",
        },
        {
            "platform": "hashnode",
            "label": "Hashnode",
            "publish_mode": "api",
            "readiness": "ready" if "hashnode" in connected_accounts else "needs-token",
            "needs": ["social account with Hashnode token"],
            "notes": "Good for canonical republishing experiments and API-driven posting.",
            "can_publish": "hashnode" in connected_accounts,
            "steps": [
                "Add a Hashnode token and publication target in Settings.",
                "Use canonical/original URL when syndicating from an owned property.",
                "Prepare a GraphQL payload and verify tags before posting.",
                "Track discovery/indexing and query rank over the next week.",
            ],
            "docs_url": "https://docs.hashnode.com/quickstart/introduction",
        },
        {
            "platform": "medium",
            "label": "Medium",
            "publish_mode": "manual-or-legacy",
            "readiness": "manual-only" if "medium" not in connected_accounts else "legacy-token",
            "needs": ["legacy Medium integration token or manual posting workflow"],
            "notes": "Use mainly for distribution experiments, not force-indexing assumptions.",
            "can_publish": "medium" in connected_accounts,
            "steps": [
                "Prepare a manual bundle with markdown, title, tags, and canonical notes.",
                "Post manually unless you already have a legacy Medium integration token.",
                "Record the published URL in the experiment once live.",
                "Treat Medium as a distribution lane, not a guaranteed SEO lab.",
            ],
            "docs_url": "https://help.medium.com/hc/en-us/articles/213480228-API-Importing",
        },
        {
            "platform": "serpapi",
            "label": "SERP API",
            "publish_mode": "tracking",
            "readiness": "ready" if "serpapi" in active_keys else "needs-token",
            "needs": ["API key for rank snapshots"],
            "notes": "Recommended for automated ranking measurement by query/country/device.",
            "can_publish": False,
            "steps": [
                "Add a SERP API key in Settings > AI Providers.",
                "Attach target query, country, and device to each experiment.",
                "Capture baseline and follow-up positions automatically.",
                "Use rank snapshots as a comparative signal, not absolute truth.",
            ],
            "docs_url": "https://serpapi.com/",
        },
    ]
    return items


def _slugify(value: str) -> str:
    text = re.sub(r"[^\w]+", "-", value.lower(), flags=re.UNICODE).strip("-")
    return text or "item"


def _playbook_for_platform(platform: str) -> list[str]:
    mapping = {
        "devto": [
            "Verify the payload title and tags before posting.",
            "Keep the article unpublished first if you want to QA the preview on-platform.",
            "Add the published URL back into the experiment for tracking.",
        ],
        "hashnode": [
            "Confirm publication target and canonical/original URL fields.",
            "Review Markdown formatting because GraphQL payloads will preserve it closely.",
            "Save the live URL and move the experiment to posted.",
        ],
        "medium": [
            "Use the manual package unless you already have a legacy Medium token.",
            "Paste the generated body into Medium carefully and review formatting.",
            "Capture the final Medium URL and move into measuring.",
        ],
    }
    return mapping.get(
        platform,
        [
            "Review the payload bundle.",
            "Publish using the target platform workflow.",
            "Record the resulting live URL for indexing and rank checks.",
        ],
    )


def _build_payload(payload: PayloadRequest) -> dict[str, Any]:
    markdown = ""
    if payload.source_artifact_path:
        markdown = qwen_read_file(payload.source_artifact_path)["text"]
    title, body = _extract_title_body(markdown, fallback_title=payload.content_title)
    canonical = payload.canonical_url or payload.published_url
    tags = payload.tags or []

    if payload.platform == "devto":
        return {
            "platform": "devto",
            "format": "json",
            "payload": {
                "article": {
                    "title": title,
                    "body_markdown": body,
                    "published": False,
                    "canonical_url": canonical,
                    "tags": tags[:4],
                }
            },
        }

    if payload.platform == "hashnode":
        return {
            "platform": "hashnode",
            "format": "graphql-variables",
            "payload": {
                "title": title,
                "contentMarkdown": body,
                "isRepublished": bool(canonical),
                "originalArticleURL": canonical,
                "tags": [{"name": tag} for tag in tags[:5]],
            },
        }

    if payload.platform == "medium":
        return {
            "platform": "medium",
            "format": "manual",
            "payload": {
                "title": title,
                "body_markdown": body,
                "canonical_url": canonical,
                "notes": "Medium automation depends on legacy integration token; otherwise use manual publishing/import workflow.",
            },
        }

    return {
        "platform": payload.platform,
        "format": "generic",
        "payload": {
            "title": title,
            "body_markdown": body,
            "canonical_url": canonical,
            "tags": tags,
        },
    }


async def _review_map(db: AsyncSession) -> dict[str, ArticleReview]:
    result = await db.execute(select(ArticleReview))
    return {row.artifact_path: row for row in result.scalars().all()}


def _lineage_nodes() -> tuple[dict[str, list[dict[str, Any]]], dict[str, dict[str, Any]]]:
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
                "source_artifact_path": str(source_artifact_path),
                "run_slug": run["slug"],
                "run_name": run["name"],
                "project": article_path.parent.name,
                "title": meta.get("title") or (text.splitlines()[0].lstrip("# ").strip() if text else article_path.stem),
                "updated_at": article_path.stat().st_mtime,
                "chars": len(text),
                "words": len(text.split()),
            }
            by_artifact[node["artifact_path"]] = node
            children_map.setdefault(node["source_artifact_path"], []).append(node)
    for key, items in children_map.items():
        items.sort(key=lambda item: item["updated_at"], reverse=True)
    return children_map, by_artifact


def _collect_descendants(source_path: str, children_map: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    stack = [source_path]
    seen: set[str] = set()
    while stack:
        current = stack.pop()
        for child in children_map.get(current, []):
            artifact_path = child["artifact_path"]
            if artifact_path in seen:
                continue
            seen.add(artifact_path)
            out.append(child)
            stack.append(artifact_path)
    out.sort(key=lambda item: item["updated_at"], reverse=True)
    return out


def _resolve_publish_candidate(
    source_artifact_path: str,
    review_by_path: dict[str, ArticleReview],
    *,
    prefer_latest_iteration: bool = True,
) -> dict[str, Any]:
    source_path = str(Path(source_artifact_path).resolve())
    children_map, _ = _lineage_nodes()
    descendants = _collect_descendants(source_path, children_map)

    candidates: list[dict[str, Any]] = [{"artifact_path": source_path, "kind": "source"}]
    candidates.extend([{**item, "kind": "descendant"} for item in descendants])

    def review_rank(path: str) -> tuple[int, float]:
        review = review_by_path.get(path)
        if not review:
            return (0, 0.0)
        verdict_weight = {
            "publishable": 4,
            "good-base": 3,
            "salvageable": 2,
            "draft": 1,
            "needs-rewrite": -1,
        }.get(review.verdict or "", 0)
        scores = [
            value
            for value in [
                review.usefulness_score,
                review.seo_score,
                review.geo_score,
                review.human_score,
                review.brand_fit_score,
                review.safety_score,
            ]
            if value is not None
        ]
        avg = round(sum(scores) / len(scores), 2) if scores else 0.0
        return (verdict_weight, avg)

    enriched: list[dict[str, Any]] = []
    for item in candidates:
        path = item["artifact_path"]
        review = review_by_path.get(path)
        try:
            text = qwen_read_file(path)["text"]
        except FileNotFoundError:
            text = ""
        title, _body = _extract_title_body(text, fallback_title=Path(path).stem)
        verdict_weight, avg = review_rank(path)
        enriched.append(
            {
                "artifact_path": path,
                "title": title,
                "kind": item.get("kind"),
                "run_slug": item.get("run_slug"),
                "run_name": item.get("run_name"),
                "updated_at": item.get("updated_at") or (Path(path).stat().st_mtime if Path(path).exists() else 0),
                "chars": len(text),
                "words": len(text.split()),
                "review_verdict": review.verdict if review else None,
                "review_score": avg,
                "verdict_weight": verdict_weight,
            }
        )

    def rank_key(item: dict[str, Any]) -> tuple[int, float, float]:
        latest_bias = 1 if (prefer_latest_iteration and item["kind"] == "descendant") else 0
        return (item["verdict_weight"] + latest_bias, item["review_score"], item["updated_at"])

    enriched.sort(key=rank_key, reverse=True)
    selected = enriched[0] if enriched else None
    return {
        "source_artifact_path": source_path,
        "selected_artifact_path": selected["artifact_path"] if selected else source_path,
        "selected_title": selected["title"] if selected else Path(source_path).stem,
        "selected_kind": selected["kind"] if selected else "source",
        "selected_review_verdict": selected.get("review_verdict") if selected else None,
        "selected_review_score": selected.get("review_score") if selected else None,
        "candidates": enriched,
    }


def _bundle_dict(row: PublicationExperiment) -> dict[str, Any]:
    payload_input = PayloadRequest(
        platform=row.platform,
        source_artifact_path=row.source_artifact_path,
        content_title=row.content_title,
        canonical_url=row.canonical_url,
        published_url=row.published_url,
        tags=[item.strip() for item in (row.tags_csv or "").split(",") if item.strip()],
    )
    payload = _build_payload(payload_input)
    markdown = ""
    if row.source_artifact_path:
        markdown = qwen_read_file(row.source_artifact_path)["text"]
    title, body = _extract_title_body(markdown, fallback_title=row.content_title)
    checklist = _playbook_for_platform(row.platform)

    return {
        "experiment": experiment_to_dict(row),
        "title": title,
        "body_markdown": body,
        "payload": payload,
        "checklist": checklist,
        "suggested_files": {
            "article_markdown": f"{_slugify(title)}.md",
            "payload_json": f"{_slugify(title)}.payload.json",
            "notes_markdown": f"{_slugify(title)}.notes.md",
        },
    }


def _write_bundle(root: Path, bundle: dict[str, Any]) -> list[str]:
    root.mkdir(parents=True, exist_ok=True)
    files: list[str] = []

    article_path = root / bundle["suggested_files"]["article_markdown"]
    article_path.write_text(f"# {bundle['title']}\n\n{bundle['body_markdown']}\n", encoding="utf-8")
    files.append(str(article_path))

    payload_path = root / bundle["suggested_files"]["payload_json"]
    payload_path.write_text(
        json.dumps(bundle["payload"], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    files.append(str(payload_path))

    notes_path = root / bundle["suggested_files"]["notes_markdown"]
    notes_text = "\n".join(f"- {item}" for item in bundle["checklist"])
    notes_path.write_text(
        f"# Publish Notes\n\n"
        f"- Platform: {bundle['experiment']['platform']}\n"
        f"- Project: {bundle['experiment']['project']}\n"
        f"- Target Query: {bundle['experiment'].get('target_query') or '—'}\n"
        f"- Canonical URL: {bundle['experiment'].get('canonical_url') or '—'}\n\n"
        f"## Checklist\n{notes_text}\n",
        encoding="utf-8",
    )
    files.append(str(notes_path))
    return files


async def _batch_articles(
    db: AsyncSession,
    run_slug: str,
    project: str | None,
    verdict: str | None,
    limit: int,
) -> list[dict[str, Any]]:
    articles = qwen_run_articles(run_slug, limit=max(limit * 3, limit))
    paths = [item["artifact_path"] for item in articles]
    reviews_result = await db.execute(select(ArticleReview).where(ArticleReview.artifact_path.in_(paths)))
    reviews = {row.artifact_path: row for row in reviews_result.scalars().all()}

    filtered: list[dict[str, Any]] = []
    for item in articles:
        if project and item["project"] != project:
            continue
        review = reviews.get(item["artifact_path"])
        review_verdict = review.verdict if review else None
        if verdict:
            if verdict == "__unreviewed__":
                if review_verdict:
                    continue
            elif review_verdict != verdict:
                continue
        filtered.append(item)
        if len(filtered) >= limit:
            break
    return filtered


@router.get("")
async def get_experiments(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    result = await db.execute(select(PublicationExperiment).order_by(PublicationExperiment.updated_at.desc()))
    return {"items": [experiment_to_dict(row) for row in result.scalars().all()]}


@router.get("/platforms")
async def get_platform_playbooks(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    accounts_result = await db.execute(select(Account).where(Account.is_active == True))  # noqa: E712
    keys_result = await db.execute(select(ApiKey).where(ApiKey.is_active == True))  # noqa: E712
    return {"items": _platform_playbooks(accounts_result.scalars().all(), keys_result.scalars().all())}


@router.get("/candidate")
async def get_publish_candidate(
    source_artifact_path: str = Query(...),
    prefer_latest_iteration: bool = Query(default=True),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    review_by_path = await _review_map(db)
    return _resolve_publish_candidate(
        source_artifact_path,
        review_by_path,
        prefer_latest_iteration=prefer_latest_iteration,
    )


@router.post("/payload-preview")
async def get_payload_preview(payload: PayloadRequest, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    resolved = None
    resolved_payload = payload
    if payload.source_artifact_path and payload.prefer_latest_iteration:
        review_by_path = await _review_map(db)
        resolved = _resolve_publish_candidate(
            payload.source_artifact_path,
            review_by_path,
            prefer_latest_iteration=True,
        )
        resolved_payload = PayloadRequest(
            platform=payload.platform,
            source_artifact_path=resolved["selected_artifact_path"],
            content_title=payload.content_title,
            canonical_url=payload.canonical_url,
            published_url=payload.published_url,
            tags=payload.tags,
            prefer_latest_iteration=payload.prefer_latest_iteration,
        )
    result = _build_payload(resolved_payload)
    result["payload_pretty"] = json.dumps(result["payload"], ensure_ascii=False, indent=2)
    if resolved:
        result["resolved_candidate"] = resolved
    return result


@router.get("/{experiment_id}/bundle")
async def get_experiment_bundle(experiment_id: int, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    result = await db.execute(select(PublicationExperiment).where(PublicationExperiment.id == experiment_id))
    row = result.scalar_one_or_none()
    if not row:
        return {"detail": "Experiment not found"}
    bundle = _bundle_dict(row)
    if row.source_artifact_path:
        review_by_path = await _review_map(db)
        bundle["resolved_candidate"] = _resolve_publish_candidate(row.source_artifact_path, review_by_path)
    return bundle


@router.post("/batch-prepare")
async def batch_prepare_experiments(payload: BatchPrepareRequest, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    items = await _batch_articles(db, payload.run_slug, payload.project, payload.verdict, payload.limit)
    review_by_path = await _review_map(db)
    created: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []

    for item in items:
        resolved = _resolve_publish_candidate(
            item["artifact_path"],
            review_by_path,
            prefer_latest_iteration=payload.prefer_latest_iteration,
        )
        selected_path = resolved["selected_artifact_path"]
        selected_title = resolved["selected_title"]
        existing = await db.execute(
            select(PublicationExperiment).where(
                PublicationExperiment.source_artifact_path == selected_path,
                PublicationExperiment.platform == payload.platform,
            )
        )
        row = existing.scalar_one_or_none()
        if row:
            skipped.append({"artifact_path": selected_path, "reason": "already-exists", "id": row.id})
            continue

        built = _build_payload(
            PayloadRequest(
                platform=payload.platform,
                source_artifact_path=selected_path,
                content_title=selected_title,
                tags=payload.tags or [],
            )
        )

        row = PublicationExperiment(
            project=item["project"],
            content_title=selected_title,
            source_artifact_path=selected_path,
            platform=payload.platform,
            status="planned",
            index_status="unknown",
            rank_status="not-started",
            payload_format=built["format"],
            payload_json=json.dumps(built["payload"], ensure_ascii=False),
            tags_csv=",".join(payload.tags or []),
            notes=(
                f"Prepared from run {payload.run_slug}. "
                f"Resolved candidate kind: {resolved['selected_kind']}. "
                f"Original source: {item['artifact_path']}"
            ),
        )
        db.add(row)
        await db.flush()
        await db.refresh(row)
        created.append(experiment_to_dict(row))

    return {
        "run_slug": payload.run_slug,
        "platform": payload.platform,
        "created": created,
        "skipped": skipped,
    }


@router.post("/export-bundles")
async def export_bundles(payload: ExportBundleRequest, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    result = await db.execute(
        select(PublicationExperiment).where(PublicationExperiment.id.in_(payload.experiment_ids))
    )
    items = result.scalars().all()
    if not items:
        return {"root": None, "count": 0, "files": []}

    label = _slugify(payload.label or "manual-export")
    root = EXPORT_ROOT / label
    root.mkdir(parents=True, exist_ok=True)
    files: list[str] = []
    manifest_items: list[dict[str, Any]] = []

    for row in items:
        bundle = _bundle_dict(row)
        bundle_root = root / f"{row.id:04d}_{_slugify(row.platform)}_{_slugify(row.content_title)[:60]}"
        files.extend(_write_bundle(bundle_root, bundle))
        manifest_items.append(
            {
                "id": row.id,
                "project": row.project,
                "platform": row.platform,
                "content_title": row.content_title,
                "bundle_path": str(bundle_root),
            }
        )

    manifest_path = root / "manifest.json"
    manifest_path.write_text(
        json.dumps(
            {
                "label": label,
                "count": len(manifest_items),
                "items": manifest_items,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    files.append(str(manifest_path))
    return {"root": str(root), "count": len(manifest_items), "files": files}


@router.post("")
async def save_experiment(payload: ExperimentUpsert, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    row: PublicationExperiment | None = None
    if payload.id:
        result = await db.execute(select(PublicationExperiment).where(PublicationExperiment.id == payload.id))
        row = result.scalar_one_or_none()

    if row is None:
        row = PublicationExperiment()
        db.add(row)

    for key, value in payload.model_dump().items():
        if key != "id":
            setattr(row, key, value)

    await db.flush()
    await db.refresh(row)
    return experiment_to_dict(row)
