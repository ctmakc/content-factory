"""
Bridge helpers for local QWEN pipeline operations.
"""
from __future__ import annotations

import json
import os
import subprocess
import time
from pathlib import Path
from typing import Any
import re


QWEN_ROOT = Path("/data/QWEN")
QWEN_CONTROL = QWEN_ROOT / "control"
QWEN_LOGS = QWEN_ROOT / "logs"
QWEN_PROMPTS = QWEN_ROOT / "prompts"
QWEN_BATTLES = QWEN_ROOT / "prompt_battle"
QWEN_QUEUE = QWEN_ROOT / "queue"


def _read_json(path: Path, default: Any):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def _tail_text(path: Path, max_chars: int = 20000) -> str:
    if not path.exists():
        return ""
    data = path.read_text(encoding="utf-8", errors="replace")
    return data[-max_chars:]


def _safe_read(path_str: str, base: Path) -> str:
    path = Path(path_str).resolve()
    if not str(path).startswith(str(base.resolve())):
        raise ValueError("Path is outside allowed base")
    if not path.exists():
        raise FileNotFoundError(path)
    return path.read_text(encoding="utf-8", errors="replace")


def qwen_status() -> dict[str, Any]:
    status_data = _read_json(QWEN_CONTROL / "state" / "status.json", {})
    runtime_data = _read_json(QWEN_CONTROL / "config" / "runtime.json", {})
    status_data["runtime"] = runtime_data
    return status_data


def qwen_runtime() -> dict[str, Any]:
    return _read_json(QWEN_CONTROL / "config" / "runtime.json", {})


def qwen_save_runtime(payload: dict[str, Any]) -> dict[str, Any]:
    current = qwen_runtime()
    current.update(payload)
    path = QWEN_CONTROL / "config" / "runtime.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(current, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return current


def qwen_prompt(name: str = "seo_article_system.txt") -> dict[str, str]:
    path = QWEN_PROMPTS / name
    return {
        "name": name,
        "path": str(path),
        "text": path.read_text(encoding="utf-8") if path.exists() else "",
    }


def qwen_save_prompt(name: str, text: str) -> dict[str, str]:
    path = QWEN_PROMPTS / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return {"name": name, "path": str(path)}


def _path_item(path: Path, base: Path) -> dict[str, Any]:
    return {
        "name": path.name,
        "path": str(path),
        "relative_path": str(path.relative_to(base)),
        "updated_at": path.stat().st_mtime,
        "size": path.stat().st_size,
    }


def qwen_queue_files() -> list[dict[str, Any]]:
    if not QWEN_QUEUE.exists():
        return []
    items = [
        _path_item(path, QWEN_QUEUE)
        for path in sorted(QWEN_QUEUE.rglob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True)
    ]
    return items


def qwen_prompt_files() -> list[dict[str, Any]]:
    if not QWEN_PROMPTS.exists():
        return []
    items = [
        _path_item(path, QWEN_PROMPTS)
        for path in sorted(QWEN_PROMPTS.rglob("*"), key=lambda p: p.stat().st_mtime, reverse=True)
        if path.is_file() and path.suffix in {".txt", ".md", ".json"}
    ]
    return items


def qwen_models() -> list[dict[str, Any]]:
    try:
        proc = subprocess.run(["ollama", "list"], capture_output=True, text=True, check=False)
    except FileNotFoundError:
        proc = None

    rows: list[dict[str, Any]] = []
    if proc and proc.returncode == 0:
        for line in proc.stdout.splitlines()[1:]:
            parts = line.split()
            if len(parts) >= 3:
                rows.append(
                    {
                        "name": parts[0],
                        "id": parts[1],
                        "size": parts[2],
                        "modified": " ".join(parts[3:]) if len(parts) > 3 else "",
                        "source": "ollama",
                    }
                )

    if rows:
        return rows

    observed: dict[str, dict[str, Any]] = {}
    runtime_model = qwen_runtime().get("model")
    if runtime_model:
        observed[runtime_model] = {
            "name": runtime_model,
            "id": "observed",
            "size": "unknown",
            "modified": "",
            "source": "runtime",
        }

    for battle in prompt_battles():
        model = battle.get("model")
        if model and model not in observed:
            observed[model] = {
                "name": model,
                "id": "observed",
                "size": "unknown",
                "modified": "",
                "source": "battle-manifest",
            }

    return list(observed.values())


def qwen_catalog() -> dict[str, Any]:
    output_roots = [
        {"name": item["name"], "path": item["root"], "updated_at": item["updated_at"], "article_count": item["article_count"]}
        for item in qwen_runs()
    ]
    return {
        "queues": qwen_queue_files(),
        "prompts": qwen_prompt_files(),
        "models": qwen_models(),
        "output_roots": output_roots,
    }


def qwen_prompt_registry() -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []

    for path in sorted(QWEN_PROMPTS.rglob("*"), key=lambda p: p.stat().st_mtime, reverse=True):
        if not path.is_file():
            continue
        if path.suffix not in {".txt", ".md", ".json"}:
            continue
        items.append(
            {
                "key": f"prompt:{path.relative_to(QWEN_ROOT)}",
                "name": path.name,
                "path": str(path),
                "kind": "prompt-file",
                "group": "core-prompts",
                "label": path.stem,
                "battle_slug": None,
                "candidate_name": None,
                "topic": None,
                "language": None,
                "model": None,
                "updated_at": path.stat().st_mtime,
                "size": path.stat().st_size,
            }
        )

    if QWEN_BATTLES.exists():
        for battle_dir in sorted([p for p in QWEN_BATTLES.iterdir() if p.is_dir()], key=lambda p: p.name, reverse=True):
            manifest = _read_json(battle_dir / "manifest.json", {})
            for candidate in manifest.get("candidates", []):
                for prompt_kind in ("user_prompt", "system_prompt"):
                    path_str = candidate.get(prompt_kind)
                    if not path_str:
                        continue
                    path = Path(path_str)
                    if not path.exists():
                        continue
                    items.append(
                        {
                            "key": f"{battle_dir.name}:{candidate['name']}:{prompt_kind}",
                            "name": path.name,
                            "path": str(path),
                            "kind": "battle-prompt",
                            "group": battle_dir.name,
                            "label": candidate["name"],
                            "battle_slug": battle_dir.name,
                            "candidate_name": candidate["name"],
                            "topic": manifest.get("topic"),
                            "language": manifest.get("language"),
                            "model": manifest.get("model"),
                            "prompt_role": "system" if prompt_kind == "system_prompt" else "user",
                            "updated_at": path.stat().st_mtime,
                            "size": path.stat().st_size,
                        }
                    )

    return sorted(items, key=lambda item: item["updated_at"], reverse=True)


def qwen_prompt_registry_map() -> dict[str, dict[str, Any]]:
    return {item["key"]: item for item in qwen_prompt_registry()}


def qwen_outputs(root: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
    target = Path(root).resolve() if root else Path(qwen_runtime().get("output_root", str(QWEN_ROOT / "output"))).resolve()
    if not target.exists():
        return []
    files = sorted(target.rglob("*.md"), key=lambda p: p.stat().st_mtime, reverse=True)
    out = []
    for path in files[:limit]:
        out.append(
            {
                "path": str(path),
                "project": path.parent.name,
                "name": path.name,
                "updated_at": path.stat().st_mtime,
                "size": path.stat().st_size,
            }
        )
    return out


def qwen_queue(limit: int = 200) -> list[dict[str, Any]]:
    queue_path = Path(qwen_runtime().get("queue_path", "")).resolve()
    if not queue_path.exists():
        return []
    items = []
    for line in queue_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            items.append(json.loads(line))
    return items[:limit]


def qwen_logs(name: str, max_chars: int = 20000) -> dict[str, str]:
    path = QWEN_LOGS / name
    return {"name": name, "path": str(path), "text": _tail_text(path, max_chars=max_chars)}


def qwen_read_file(path: str) -> dict[str, str]:
    text = _safe_read(path, QWEN_ROOT)
    return {"path": path, "text": text}


def qwen_action(action: str) -> dict[str, Any]:
    mapping = {
        "start_ollama": ["systemctl", "--user", "start", "qwen-ollama.service"],
        "stop_ollama": ["systemctl", "--user", "stop", "qwen-ollama.service"],
        "start_run": ["systemctl", "--user", "start", "--no-block", "qwen-nightly.service"],
        "stop_run": ["systemctl", "--user", "stop", "qwen-nightly.service"],
        "restart_web": ["systemctl", "--user", "restart", "qwen-web.service"],
    }
    cmd = mapping.get(action)
    if not cmd:
        raise ValueError(f"Unknown action: {action}")
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or proc.stdout.strip() or "Command failed")
    return {"action": action, "status": "ok"}


def qwen_launch_run(payload: dict[str, Any]) -> dict[str, Any]:
    runtime_payload = {
        key: value
        for key, value in payload.items()
        if key in {"model", "queue_path", "output_root", "limit", "offset"} and value is not None
    }
    if runtime_payload:
        qwen_save_runtime(runtime_payload)

    if payload.get("stop_existing"):
        try:
            qwen_action("stop_run")
        except RuntimeError:
            pass

    return qwen_action("start_run")


def prompt_battles() -> list[dict[str, Any]]:
    if not QWEN_BATTLES.exists():
        return []
    items = []
    for battle_dir in sorted([p for p in QWEN_BATTLES.iterdir() if p.is_dir()], key=lambda p: p.name, reverse=True):
        manifest = _read_json(battle_dir / "manifest.json", {})
        summary = _read_json(battle_dir / "results" / "summary.json", {})
        run_state = prompt_battle_run_state(battle_dir.name)
        items.append(
            {
                "slug": battle_dir.name,
                "path": str(battle_dir),
                "topic": manifest.get("topic", ""),
                "language": manifest.get("language", ""),
                "model": manifest.get("model", ""),
                "candidate_count": len(manifest.get("candidates", [])),
                "result_count": len(summary.get("results", [])),
                "run_state": run_state,
            }
        )
    return items


def qwen_test_cases() -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for battle in prompt_battles():
        detail = prompt_battle_detail(battle["slug"])
        ranking = sorted(
            [item for item in detail.get("summary", {}).get("results", []) if item.get("chars") is not None],
            key=lambda row: row.get("chars", 0),
            reverse=True,
        )
        items.append(
            {
                "slug": battle["slug"],
                "topic": detail.get("manifest", {}).get("topic"),
                "language": detail.get("manifest", {}).get("language"),
                "model": detail.get("manifest", {}).get("model"),
                "candidate_count": len(detail.get("candidates", [])),
                "result_count": len(detail.get("summary", {}).get("results", [])),
                "updated_at": max(
                    [
                        (battle["run_state"] or {}).get("started_at") or "",
                        (detail.get("summary") or {}).get("generated_at") or "",
                    ]
                ),
                "top_outputs": [
                    {
                        "name": item.get("name"),
                        "chars": item.get("chars"),
                        "words": item.get("words"),
                        "seconds": item.get("seconds"),
                    }
                    for item in ranking[:3]
                ],
            }
        )
    return items


def _slugify(value: str) -> str:
    text = re.sub(r"[^\w]+", "-", value.lower(), flags=re.UNICODE).strip("-")
    return text or "item"


def _battle_runner_script() -> str:
    return """#!/usr/bin/env python3
import json
import time
from pathlib import Path
from urllib import request


ROOT = Path(__file__).resolve().parent
MANIFEST_PATH = ROOT / "manifest.json"
RESULTS_DIR = ROOT / "results"
API_URL = "http://127.0.0.1:11434/api/generate"


def ollama_generate(model: str, system_prompt: str, user_prompt: str) -> str:
    payload = {
        "model": model,
        "system": system_prompt,
        "prompt": user_prompt,
        "stream": False,
        "options": {
            "temperature": 0.42,
            "top_p": 0.88,
            "num_ctx": 8192,
            "num_predict": 2400,
            "repeat_penalty": 1.12,
        },
    }
    data = json.dumps(payload).encode("utf-8")
    req = request.Request(API_URL, data=data, headers={"Content-Type": "application/json"})
    with request.urlopen(req, timeout=3600) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    return body["response"].strip()


def read_text(path: str | None) -> str:
    if not path:
        return ""
    return Path(path).read_text(encoding="utf-8")


def stats(text: str) -> dict:
    lines = text.splitlines()
    paragraphs = [p for p in text.split("\\n\\n") if p.strip()]
    return {
        "chars": len(text),
        "words": len(text.split()),
        "h2": sum(1 for line in lines if line.startswith("## ")),
        "h3": sum(1 for line in lines if line.startswith("### ")),
        "lists": sum(1 for line in lines if line.startswith("- ") or (len(line) > 2 and line[0].isdigit() and line[1:3] == ". ")),
        "paragraphs": len(paragraphs),
    }


def main():
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    summary = {
        "topic": manifest["topic"],
        "model": manifest["model"],
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "results": [],
    }

    for item in manifest["candidates"]:
        name = item["name"]
        print(f"running {name}", flush=True)
        system_prompt = read_text(item.get("system_prompt"))
        user_prompt = read_text(item["user_prompt"])
        started = time.time()
        article = ollama_generate(manifest["model"], system_prompt, user_prompt)
        elapsed = round(time.time() - started, 1)

        article_path = RESULTS_DIR / f"{name}.md"
        meta_path = RESULTS_DIR / f"{name}.json"
        article_path.write_text(article + "\\n", encoding="utf-8")

        row = {
            "name": name,
            "seconds": elapsed,
            "article_path": str(article_path),
            **stats(article),
        }
        meta_path.write_text(json.dumps(row, ensure_ascii=False, indent=2) + "\\n", encoding="utf-8")
        summary["results"].append(row)
        print(f"saved {name} ({elapsed}s)", flush=True)

    (RESULTS_DIR / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\\n", encoding="utf-8")
    print(f"done: {len(summary['results'])} candidates", flush=True)


if __name__ == "__main__":
    main()
"""


def qwen_create_prompt_battle(
    *,
    topic: str,
    language: str,
    model: str,
    asset_keys: list[str],
    battle_type: str = "dataset-driven prompt battle",
    slug_hint: str | None = None,
    auto_start: bool = False,
) -> dict[str, Any]:
    registry = qwen_prompt_registry_map()
    selected_assets = []
    for key in asset_keys:
        asset = registry.get(key)
        if asset:
            selected_assets.append(asset)
    if not selected_assets:
        raise ValueError("No valid prompt assets selected")

    slug_base = slug_hint or _slugify(topic)[:48]
    stamp = time.strftime("%Y%m%d-%H%M%S")
    slug = f"{slug_base}-{stamp}"
    battle_dir = QWEN_BATTLES / slug
    battle_dir.mkdir(parents=True, exist_ok=True)
    (battle_dir / "results").mkdir(parents=True, exist_ok=True)
    (battle_dir / "candidates").mkdir(parents=True, exist_ok=True)

    candidates = []
    used_names: set[str] = set()
    for asset in selected_assets:
        base_name = asset.get("candidate_name") or asset.get("label") or Path(asset["path"]).stem
        name = _slugify(base_name)
        if name in used_names:
            idx = 2
            while f"{name}-{idx}" in used_names:
                idx += 1
            name = f"{name}-{idx}"
        used_names.add(name)
        candidates.append(
            {
                "name": name,
                "user_prompt": asset["path"],
                "system_prompt": None,
            }
        )

    manifest = {
        "model": model,
        "topic": topic,
        "language": language,
        "battle_type": battle_type,
        "candidates": candidates,
    }
    (battle_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    runner_path = battle_dir / "run_battle.py"
    runner_path.write_text(_battle_runner_script(), encoding="utf-8")
    runner_path.chmod(0o755)

    detail = {
        "slug": slug,
        "path": str(battle_dir),
        "manifest": manifest,
    }
    if auto_start:
        detail["run_state"] = start_prompt_battle(slug)
    return detail


def _battle_paths(slug: str) -> dict[str, Path]:
    battle_dir = (QWEN_BATTLES / slug).resolve()
    return {
        "dir": battle_dir,
        "log": battle_dir / "battle.log",
        "state": battle_dir / "run_state.json",
        "runner": battle_dir / "run_battle.py",
    }


def prompt_battle_run_state(slug: str) -> dict[str, Any]:
    paths = _battle_paths(slug)
    state = _read_json(paths["state"], {})
    pid = state.get("pid")
    running = False
    if pid:
        try:
            os.kill(pid, 0)
            status_path = Path(f"/proc/{pid}/status")
            if status_path.exists():
                status_text = status_path.read_text(encoding="utf-8", errors="replace")
                running = "State:\tZ" not in status_text
            else:
                running = True
        except OSError:
            running = False
    state["running"] = running
    state["log_path"] = str(paths["log"])
    return state


def start_prompt_battle(slug: str) -> dict[str, Any]:
    paths = _battle_paths(slug)
    if not paths["dir"].exists():
        raise FileNotFoundError(slug)

    current = prompt_battle_run_state(slug)
    if current.get("running"):
        return current

    log_path = paths["log"]
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_handle = log_path.open("ab")
    proc = subprocess.Popen(
        ["python3", str(paths["runner"])],
        cwd=str(paths["dir"]),
        stdout=log_handle,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    state = {
        "slug": slug,
        "pid": proc.pid,
        "started_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "running": True,
        "log_path": str(log_path),
    }
    paths["state"].write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return state


def prompt_battle_detail(slug: str) -> dict[str, Any]:
    battle_dir = (QWEN_BATTLES / slug).resolve()
    if not battle_dir.exists():
        raise FileNotFoundError(slug)
    manifest = _read_json(battle_dir / "manifest.json", {})
    summary = _read_json(battle_dir / "results" / "summary.json", {})
    candidates = []
    for item in manifest.get("candidates", []):
        result_meta = battle_dir / "results" / f"{item['name']}.json"
        result = _read_json(result_meta, {})
        candidates.append(
            {
                "name": item["name"],
                "user_prompt": item["user_prompt"],
                "system_prompt": item.get("system_prompt"),
                "result": result,
            }
        )
    return {
        "slug": slug,
        "manifest": manifest,
        "summary": summary,
        "candidates": candidates,
        "run_state": prompt_battle_run_state(slug),
        "log": _tail_text(battle_dir / "battle.log", max_chars=40000),
    }


def _run_row(slug: str, name: str, source_type: str, root: Path, files: list[Path]) -> dict[str, Any]:
    updated_at = max((p.stat().st_mtime for p in files), default=0)
    projects = sorted({p.parent.name for p in files})
    return {
        "slug": slug,
        "name": name,
        "source_type": source_type,
        "root": str(root),
        "article_count": len(files),
        "project_count": len(projects),
        "projects": projects,
        "updated_at": updated_at,
    }


def qwen_runs() -> list[dict[str, Any]]:
    runs: list[dict[str, Any]] = []

    candidate_roots: list[tuple[str, str, Path]] = []
    main_output = QWEN_ROOT / "output"
    if main_output.exists():
        candidate_roots.append(("main-output", "Main Output", main_output))

    compare_root = QWEN_ROOT / "output_compare"
    if compare_root.exists():
        for path in sorted([p for p in compare_root.iterdir() if p.is_dir()]):
            candidate_roots.append((f"compare-{path.name}", f"Compare {path.name}", path))

    for path in sorted(QWEN_ROOT.glob("output_mass_*")):
        if path.is_dir():
            candidate_roots.append((path.name, path.name.replace("_", " ").title(), path))

    output_runs_root = QWEN_ROOT / "output_runs"
    if output_runs_root.exists():
        for path in sorted([p for p in output_runs_root.iterdir() if p.is_dir()]):
            candidate_roots.append((path.name, path.name.replace("_", " ").title(), path))

    for slug, name, root in candidate_roots:
        files = sorted(root.rglob("*.md"))
        if files:
            runs.append(_run_row(slug, name, "output", root, files))

    if QWEN_BATTLES.exists():
        for battle_dir in sorted([p for p in QWEN_BATTLES.iterdir() if p.is_dir()]):
            results_dir = battle_dir / "results"
            files = sorted(results_dir.glob("*.md"))
            if files:
                runs.append(_run_row(f"battle-{battle_dir.name}", f"Battle {battle_dir.name}", "battle", results_dir, files))

    return sorted(runs, key=lambda item: item["updated_at"], reverse=True)


def qwen_run_articles(slug: str, limit: int = 200) -> list[dict[str, Any]]:
    runs = {item["slug"]: item for item in qwen_runs()}
    run = runs.get(slug)
    if not run:
        raise FileNotFoundError(slug)
    root = Path(run["root"])
    files = sorted(root.rglob("*.md"), key=lambda p: p.stat().st_mtime, reverse=True)
    out = []
    for path in files[:limit]:
        text = path.read_text(encoding="utf-8", errors="replace")
        out.append(
            {
                "artifact_path": str(path),
                "project": path.parent.name,
                "name": path.name,
                "title": text.splitlines()[0].lstrip("# ").strip() if text else path.stem,
                "chars": len(text),
                "words": len(text.split()),
                "updated_at": path.stat().st_mtime,
                "run_slug": slug,
            }
        )
    return out


def qwen_compare_candidates(artifact_path: str, limit: int = 20) -> dict[str, Any]:
    target = Path(artifact_path).resolve()
    if not target.exists():
        raise FileNotFoundError(artifact_path)

    target_name = target.name
    target_project = target.parent.name
    target_stem = target.stem
    enforce_project = target_project != "results"
    candidates: list[dict[str, Any]] = []

    for run in qwen_runs():
        root = Path(run["root"])
        for path in root.rglob("*.md"):
            if path.resolve() == target:
                continue
            same_name = path.name == target_name
            same_stem_suffix = path.stem.split("_", 1)[-1] == target_stem.split("_", 1)[-1]
            if enforce_project and path.parent.name != target_project:
                continue
            if not same_name and not same_stem_suffix:
                continue
            text = path.read_text(encoding="utf-8", errors="replace")
            candidates.append(
                {
                    "artifact_path": str(path),
                    "project": path.parent.name,
                    "run_slug": run["slug"],
                    "run_name": run["name"],
                    "name": path.name,
                    "title": text.splitlines()[0].lstrip("# ").strip() if text else path.stem,
                    "chars": len(text),
                    "words": len(text.split()),
                    "updated_at": path.stat().st_mtime,
                }
            )

    candidates.sort(key=lambda item: item["updated_at"], reverse=True)
    return {
        "target": {
            "artifact_path": str(target),
            "project": target_project,
            "name": target.name,
        },
        "items": candidates[:limit],
    }
