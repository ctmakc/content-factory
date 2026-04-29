#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


DEFAULT_SOURCE_ROOT = Path("/data/projects/!products/social-posting/Smmposting/content/evergreen_articles")
DEFAULT_OUTPUT_ROOT = Path("/data/QWEN/output_runs")
DEFAULT_RUN_SLUG = "innova-evergreen-20260416"


def load_manifest(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def strip_frontmatter(markdown: str) -> str:
    if not markdown.startswith("---\n"):
        return markdown.strip() + "\n"
    parts = markdown.split("\n---\n", 1)
    if len(parts) != 2:
        return markdown.strip() + "\n"
    return parts[1].lstrip() + ("\n" if not parts[1].endswith("\n") else "")


def ensure_heading(markdown: str, title: str) -> str:
    body = markdown.lstrip()
    if body.startswith("# "):
        return body if body.endswith("\n") else body + "\n"
    return f"# {title}\n\n{body}" if body else f"# {title}\n"


def write_article(
    *,
    source_root: Path,
    run_root: Path,
    article: dict,
    index: int,
    imported_at: str,
) -> dict:
    relative_path = Path(article["path"])
    source_path = source_root / relative_path.relative_to("content/evergreen_articles")
    raw_markdown = source_path.read_text(encoding="utf-8")
    cleaned_markdown = ensure_heading(strip_frontmatter(raw_markdown), article["title"])

    project_dir = run_root / article["brand_slug"]
    project_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{index:03d}_{article['slug']}"
    article_path = project_dir / f"{filename}.md"
    meta_path = project_dir / f"{filename}.json"

    article_path.write_text(cleaned_markdown, encoding="utf-8")
    metadata = {
        "title": article["title"],
        "brand_name": article["brand_name"],
        "brand_slug": article["brand_slug"],
        "slug": article["slug"],
        "project": article["brand_slug"],
        "canonical_section_url": article.get("canonical_section_url"),
        "platform_targets": article.get("platform_targets", []),
        "tags": article.get("tags", []),
        "imported_from_manifest": str(source_root / "manifest.json"),
        "imported_from_article": str(source_path),
        "imported_at": imported_at,
        "distribution_kind": "evergreen_article",
        "status": "draft",
    }
    meta_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    return {
        "artifact_path": str(article_path),
        "meta_path": str(meta_path),
        "brand_slug": article["brand_slug"],
        "title": article["title"],
        "slug": article["slug"],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Import INNOVA evergreen articles into content-factory workspace runs.")
    parser.add_argument("--source-root", default=str(DEFAULT_SOURCE_ROOT), help="Folder containing manifest.json and brand article folders.")
    parser.add_argument("--output-root", default=str(DEFAULT_OUTPUT_ROOT), help="QWEN output_runs root.")
    parser.add_argument("--run-slug", default=DEFAULT_RUN_SLUG, help="Target run slug under output_runs.")
    args = parser.parse_args()

    source_root = Path(args.source_root).resolve()
    output_root = Path(args.output_root).resolve()
    run_root = output_root / args.run_slug
    run_root.mkdir(parents=True, exist_ok=True)

    manifest = load_manifest(source_root / "manifest.json")
    imported_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()

    written: list[dict] = []
    for brand_slug in ["crystal", "mmix", "blocons", "legal"]:
        brand_articles = [item for item in manifest["articles"] if item["brand_slug"] == brand_slug]
        for index, article in enumerate(brand_articles, start=1):
            written.append(
                write_article(
                    source_root=source_root,
                    run_root=run_root,
                    article=article,
                    index=index,
                    imported_at=imported_at,
                )
            )

    summary = {
        "run_slug": args.run_slug,
        "imported_at": imported_at,
        "article_count": len(written),
        "source_root": str(source_root),
        "items": written,
    }
    (run_root / "_import_manifest.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
