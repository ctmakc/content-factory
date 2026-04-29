#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from urllib import error, parse, request


DEFAULT_BASE_URL = "http://127.0.0.1:8001/api"
DEFAULT_RUN_SLUG = "innova-evergreen-20260416"
DEFAULT_PLATFORMS = ["medium", "vc_ru", "teletype"]
PROJECT_TAGS = {
    "crystal": ["ai", "automation", "international-business", "operations"],
    "mmix": ["ai", "marketing", "automation", "agency-ops"],
    "blocons": ["ai", "web3", "crypto", "compliance"],
    "legal": ["ai", "legal", "compliance", "governance"],
}
DEFAULT_REVIEW = {
    "usefulness_score": 5,
    "seo_score": 4,
    "geo_score": 4,
    "human_score": 5,
    "brand_fit_score": 5,
    "safety_score": 5,
    "verdict": "publishable",
}


def api_call(base_url: str, method: str, path: str, payload: dict | None = None) -> dict:
    url = f"{base_url}{path}"
    data = None
    headers = {"Content-Type": "application/json"}
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = request.Request(url, data=data, headers=headers, method=method)
    try:
        with request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {url} failed: {exc.code} {body}") from exc


def get_run_articles(base_url: str, run_slug: str) -> list[dict]:
    path = f"/workspace/runs/{parse.quote(run_slug)}/articles?limit=500"
    result = api_call(base_url, "GET", path)
    return result["items"]


def save_reviews(base_url: str, articles: list[dict]) -> list[dict]:
    saved = []
    for article in articles:
        review = {
            "run_slug": article["run_slug"],
            "artifact_path": article["artifact_path"],
            "project": article["project"],
            "title": article["title"],
            **DEFAULT_REVIEW,
            "notes": "Imported evergreen article pack. Ready for manual syndication bundles and editorial QA.",
            "tags": ["imported", "evergreen", article["project"]],
        }
        saved.append(api_call(base_url, "POST", "/workspace/reviews", review))
    return saved


def batch_prepare(base_url: str, run_slug: str, project: str, platform: str) -> dict:
    payload = {
        "run_slug": run_slug,
        "platform": platform,
        "project": project,
        "verdict": "publishable",
        "limit": 100,
        "tags": PROJECT_TAGS.get(project, ["ai", "automation"]),
        "prefer_latest_iteration": True,
    }
    return api_call(base_url, "POST", "/experiments/batch-prepare", payload)


def export_bundles(base_url: str, experiment_ids: list[int], label: str) -> dict:
    return api_call(
        base_url,
        "POST",
        "/experiments/export-bundles",
        {"experiment_ids": experiment_ids, "label": label},
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare publication reviews and bundles for imported INNOVA articles.")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--run-slug", default=DEFAULT_RUN_SLUG)
    parser.add_argument("--platform", action="append", dest="platforms", help="Repeat for specific platforms only.")
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")
    platforms = args.platforms or DEFAULT_PLATFORMS

    articles = get_run_articles(base_url, args.run_slug)
    reviews = save_reviews(base_url, articles)

    projects = sorted({item["project"] for item in articles})
    batches = []
    exports = []
    for project in projects:
        for platform in platforms:
            prepared = batch_prepare(base_url, args.run_slug, project, platform)
            created_ids = [item["id"] for item in prepared.get("created", []) if item.get("id") is not None]
            skipped_ids = [item["id"] for item in prepared.get("skipped", []) if item.get("id") is not None]
            experiment_ids = created_ids + skipped_ids
            export = (
                export_bundles(
                    base_url,
                    experiment_ids,
                    f"{args.run_slug}-{project}-{platform}",
                )
                if experiment_ids
                else {"root": None, "count": 0, "files": []}
            )
            batches.append(
                {
                    "project": project,
                    "platform": platform,
                    "created": len(created_ids),
                    "skipped": len(skipped_ids),
                    "experiment_ids": experiment_ids,
                }
            )
            exports.append(
                {
                    "project": project,
                    "platform": platform,
                    "root": export.get("root"),
                    "count": export.get("count", 0),
                }
            )

    summary = {
        "run_slug": args.run_slug,
        "review_count": len(reviews),
        "projects": projects,
        "platforms": platforms,
        "batches": batches,
        "exports": exports,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
