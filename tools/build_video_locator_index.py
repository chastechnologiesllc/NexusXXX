"""Build a compact deterministic locator index for clean video URLs.

Each line stores one exact mapping as: video_id<TAB>catalog_file<TAB>record_index.
The index is split into deterministic hash buckets so the Edge Function reads a
small bounded file for one requested ID rather than scanning a category.
"""
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

BUCKET_COUNT = 1024


def bucket_for(video_id: str) -> int:
    value = 2166136261
    for char in video_id.lower():
        value ^= ord(char)
        value = (value * 16777619) & 0xFFFFFFFF
    return value & (BUCKET_COUNT - 1)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", type=Path, default=Path("js/catalog"))
    parser.add_argument("--output", type=Path, default=Path("js/catalog/locator-index"))
    args = parser.parse_args()
    index = json.loads((args.catalog / "index.json").read_text(encoding="utf-8"))
    if args.output.exists():
        shutil.rmtree(args.output)
    args.output.mkdir(parents=True)
    handles = {}
    counts = [0] * BUCKET_COUNT
    total = 0
    seen: set[str] = set()
    try:
        for entry in index.get("categories", []):
            for relative in entry.get("files", []):
                path = args.catalog / str(relative)
                payload = json.loads(path.read_text(encoding="utf-8"))
                videos = payload.get("videos", [])
                for record_index, video in enumerate(videos):
                    video_id = str(video.get("id", "")).strip()
                    if not video_id:
                        continue
                    if video_id in seen:
                        raise SystemExit(f"duplicate video id in catalog: {video_id}")
                    seen.add(video_id)
                    bucket = bucket_for(video_id)
                    handle = handles.get(bucket)
                    if handle is None:
                        handle = (args.output / f"{bucket:03x}.txt").open("w", encoding="utf-8")
                        handles[bucket] = handle
                    handle.write(f"{video_id}\t{relative}\t{record_index}\n")
                    counts[bucket] += 1
                    total += 1
    finally:
        for handle in handles.values():
            handle.close()
    manifest = {
        "version": "1.0",
        "bucketCount": BUCKET_COUNT,
        "totalVideos": total,
        "catalogVersion": index.get("version"),
        "generated": index.get("generated"),
        "source": "js/catalog/index.json",
        "nonEmptyBuckets": sum(1 for count in counts if count),
        "maxBucketRecords": max(counts or [0]),
    }
    (args.output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
