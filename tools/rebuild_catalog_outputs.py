#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path

from build_full_catalog import build_outputs, display_name


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--summary", type=Path, required=True)
    args = parser.parse_args()

    conn = sqlite3.connect(args.db)
    slugs = [row[0] for row in conn.execute("SELECT DISTINCT category_slug FROM videos ORDER BY category_slug")]
    for slug in slugs:
        conn.execute("UPDATE videos SET category_name=? WHERE category_slug=?", (display_name(slug, slug), slug))
    conn.commit()
    conn.close()

    ingest = json.loads(args.summary.read_text(encoding="utf-8"))["ingest"]
    index = build_outputs(args.db, args.output, ingest)
    print(json.dumps({"unique_videos": index["total_videos"], "categories": index["category_count"], "featured": index["featured_count"]}, indent=2))


if __name__ == "__main__":
    main()
