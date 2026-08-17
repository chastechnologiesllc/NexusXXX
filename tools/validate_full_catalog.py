#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

EMBED_RE = re.compile(r"^https://www\.pornhub\.com/embed/[A-Za-z0-9]+$")
THUMB_PREFIXES = ("https://ei.phncdn.com/", "https://di.phncdn.com/")
REQUIRED = {"id", "title", "slug", "thumb", "duration", "views", "category", "tags", "embedSrc", "source", "added", "pageUrl"}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path)
    args = parser.parse_args()
    root = args.root
    index = json.loads((root / "index.json").read_text(encoding="utf-8"))
    errors: list[str] = []
    seen: set[str] = set()
    observed = 0
    observed_categories = 0
    chunk_files = 0

    for entry in index["categories"]:
        slug = entry["slug"]
        category_dir = root / slug
        if not category_dir.is_dir():
            errors.append(f"missing category directory: {slug}")
            continue
        category_observed = 0
        files = entry.get("files", [])
        if len(files) != entry.get("parts"):
            errors.append(f"part count mismatch in index: {slug}")
        for rel in files:
            path = root / rel
            if not path.is_file():
                errors.append(f"missing chunk: {rel}")
                continue
            chunk_files += 1
            data = json.loads(path.read_text(encoding="utf-8"))
            if data.get("slug") != slug:
                errors.append(f"slug mismatch: {rel}")
            records = data.get("videos")
            if not isinstance(records, list):
                errors.append(f"videos array missing: {rel}")
                continue
            for video in records:
                observed += 1
                category_observed += 1
                video_id = str(video.get("id", ""))
                if not video_id:
                    errors.append(f"empty id: {rel}")
                if video_id in seen:
                    errors.append(f"duplicate id: {video_id}")
                seen.add(video_id)
                missing = REQUIRED - set(video)
                if missing:
                    errors.append(f"missing fields {sorted(missing)}: {video_id}")
                if video.get("source") != "Pornhub":
                    errors.append(f"unexpected source: {video_id}")
                if not EMBED_RE.match(str(video.get("embedSrc", ""))):
                    errors.append(f"invalid embed: {video_id}")
                if not str(video.get("thumb", "")).startswith(THUMB_PREFIXES):
                    errors.append(f"invalid thumb: {video_id}")
                if video.get("category") != entry["name"]:
                    errors.append(f"category mismatch: {video_id}")
        if category_observed != int(entry["count"]):
            errors.append(f"category count mismatch {slug}: {category_observed} != {entry['count']}")
        observed_categories += category_observed

    if observed != int(index["total_videos"]):
        errors.append(f"total mismatch: {observed} != {index['total_videos']}")
    if observed_categories != observed:
        errors.append("category observation mismatch")
    if chunk_files != sum(int(entry.get("parts", 0)) for entry in index["categories"]):
        errors.append("chunk inventory mismatch")

    report = {
        "valid": not errors,
        "errors": errors[:100],
        "error_count": len(errors),
        "total_videos": observed,
        "categories": len(index["categories"]),
        "chunks": chunk_files,
        "unique_ids": len(seen),
    }
    (root.parent / "full-catalog-validation-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if report["valid"] else 1)


if __name__ == "__main__":
    main()
