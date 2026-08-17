#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

REQUIRED = ("id", "title", "thumb", "embedSrc", "duration", "views", "category", "tags")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", type=Path, default=Path("js/catalog"))
    parser.add_argument("--related", type=Path, default=Path("js/catalog/related.json"))
    parser.add_argument("--report", type=Path, default=Path("audit/related-validation.json"))
    args = parser.parse_args()
    index = json.loads((args.catalog / "index.json").read_text(encoding="utf-8"))
    related = json.loads(args.related.read_text(encoding="utf-8"))
    expected = {str(entry["slug"]) for entry in index["categories"]}
    actual = set(related.get("categories", {}))
    errors: list[str] = []
    if expected != actual:
        errors.append(f"category mismatch: expected={len(expected)} actual={len(actual)}")
    ids: set[str] = set()
    count = 0
    for slug, entry in related.get("categories", {}).items():
        if not entry.get("videos"):
            errors.append(f"empty seed: {slug}")
        for video in entry.get("videos", []):
            count += 1
            video_id = str(video.get("id", ""))
            if not video_id:
                errors.append(f"missing id: {slug}")
            if video_id in ids:
                errors.append(f"duplicate id: {video_id}")
            ids.add(video_id)
            for field in REQUIRED:
                if field not in video:
                    errors.append(f"{slug}/{video_id}: missing {field}")
    if count != int(related.get("video_count", -1)):
        errors.append("video_count mismatch")
    report = {"valid": not errors, "errors": errors, "categories": len(actual), "seed_videos": count, "unique_ids": len(ids)}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if not errors else 1)


if __name__ == "__main__":
    main()
