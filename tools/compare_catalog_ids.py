#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", type=Path, required=True)
    parser.add_argument("--old-ids", type=Path, required=True)
    args = parser.parse_args()
    old_ids = {line.strip() for line in args.old_ids.read_text(encoding="utf-8").splitlines() if line.strip()}
    conn = sqlite3.connect(args.db)
    new_count = conn.execute("SELECT COUNT(*) FROM videos").fetchone()[0]
    overlap = 0
    for (video_id,) in conn.execute("SELECT id FROM videos"):
        if video_id in old_ids:
            overlap += 1
    conn.close()
    print(f"old_unique={len(old_ids)}")
    print(f"new_unique={new_count}")
    print(f"overlap={overlap}")
    print(f"net_new={new_count - overlap}")


if __name__ == "__main__":
    main()
