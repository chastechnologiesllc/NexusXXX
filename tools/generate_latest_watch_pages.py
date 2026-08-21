#!/usr/bin/env python3
"""Add crawlable watch pages for records in latest/* feeds without deleting featured pages."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from generate_watch_pages import page_html, watch_slug


def load_latest(root: Path) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    seen: set[str] = set()
    for path in sorted(root.glob("*/*.json"), reverse=True):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        for raw in payload.get("videos", []):
            if not isinstance(raw, dict):
                continue
            video = dict(raw)
            video_id = str(video.get("id", ""))
            if not video_id or video_id in seen:
                continue
            video["category"] = "Newest"
            video.setdefault("thumbFallback", "")
            video["watchUrl"] = "pages/watch/" + watch_slug(video) + ".html"
            seen.add(video_id)
            records.append(video)
    return records


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--latest-root", type=Path, default=Path("latest"))
    parser.add_argument("--config", type=Path, default=Path("seo/site-config.json"))
    parser.add_argument("--output", type=Path, default=Path("pages/watch"))
    parser.add_argument("--summary", type=Path, default=Path("seo/watch-build-summary.json"))
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding="utf-8"))
    site_url = str(config.get("siteUrl", "")).strip().rstrip("/")
    if not site_url:
        raise SystemExit("seo/site-config.json must contain a public siteUrl")
    records = load_latest(args.latest_root)
    args.output.mkdir(parents=True, exist_ok=True)
    written = 0
    for video in records:
        path = args.output / f"{watch_slug(video)}.html"
        path.write_text(page_html(video, site_url), encoding="utf-8")
        written += 1
    total_pages = len(list(args.output.glob("*.html")))
    args.summary.parent.mkdir(parents=True, exist_ok=True)
    args.summary.write_text(json.dumps({"siteUrl": site_url, "watchPages": total_pages, "featuredPages": total_pages - written, "latestPages": written, "output": str(args.output)}, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"latestRecords": len(records), "pagesWritten": written, "watchPages": total_pages, "output": str(args.output)}, indent=2))


if __name__ == "__main__":
    main()
