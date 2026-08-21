#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from generate_watch_pages import watch_slug


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("latest"))
    args = parser.parse_args()
    changed = 0
    records = 0
    for path in sorted(args.root.glob("*/*.json")):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        videos = payload.get("videos")
        if not isinstance(videos, list):
            continue
        updated = []
        for raw in videos:
            if not isinstance(raw, dict):
                continue
            video = dict(raw)
            video["category"] = "Newest"
            video.setdefault("thumbFallback", "")
            video["watchUrl"] = "pages/watch/" + watch_slug(video) + ".html"
            updated.append(video)
        payload["videos"] = updated
        path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        changed += 1
        records += len(updated)
    print(json.dumps({"filesChanged": changed, "recordsUpdated": records}, indent=2))


if __name__ == "__main__":
    main()
