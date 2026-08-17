#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path

SEED_PER_CATEGORY = 40
KEEP_FIELDS = ("id", "title", "thumb", "embedSrc", "duration", "views", "added", "category", "tags")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", type=Path, default=Path("js/catalog"))
    parser.add_argument("--output", type=Path, default=Path("js/catalog/related.json"))
    args = parser.parse_args()

    index = json.loads((args.catalog / "index.json").read_text(encoding="utf-8"))
    categories: dict[str, object] = {}
    total = 0
    for entry in index["categories"]:
        files = entry.get("files") or ([entry["file"]] if entry.get("file") else [])
        if not files:
            continue
        first = json.loads((args.catalog / files[0]).read_text(encoding="utf-8"))
        videos = []
        seen: set[str] = set()
        for video in first.get("videos", []):
            video_id = str(video.get("id", ""))
            if not video_id or video_id in seen:
                continue
            seen.add(video_id)
            item = {key: video.get(key) for key in KEEP_FIELDS if key in video}
            item["category"] = first.get("category") or entry["name"]
            videos.append(item)
            if len(videos) >= SEED_PER_CATEGORY:
                break
        slug = str(entry["slug"])
        categories[slug] = {
            "name": entry["name"],
            "count": int(entry["count"]),
            "files": len(files),
            "videos": videos,
        }
        total += len(videos)

    payload = {
        "version": "1.0",
        "generated": date.today().isoformat(),
        "source": "first popularity-ranked chunk of every canonical category",
        "seed_per_category": SEED_PER_CATEGORY,
        "category_count": len(categories),
        "video_count": total,
        "categories": categories,
    }
    args.output.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({"categories": len(categories), "seed_videos": total, "output": str(args.output)}, indent=2))


if __name__ == "__main__":
    main()
