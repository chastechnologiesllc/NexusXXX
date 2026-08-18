#!/usr/bin/env python3
"""Build the compact chunk index consumed by the browser-side unseen-video sampler."""

from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data" / "pornhub-db-split" / "manifest.csv"
OUTPUT = ROOT / "data" / "pornhub-db-split" / "feed-index.json"

parts: list[dict[str, object]] = []
with MANIFEST.open("r", encoding="utf-8-sig", newline="") as handle:
    for row in csv.DictReader(handle):
        parts.append({
            "category": row["category"],
            "categorySlug": row["category_slug"],
            "part": int(row["part"]),
            "rows": int(row["rows"]),
            "bytes": int(row["bytes"]),
            "path": "data/pornhub-db-split/" + row["path"].strip(),
        })

payload = {
    "version": 1,
    "sourceRows": sum(int(part["rows"]) for part in parts),
    "parts": parts,
}
OUTPUT.write_text(json.dumps(payload, separators=(",", ":")) + "\n", encoding="utf-8")
print(f"wrote {OUTPUT} with {len(parts)} parts and {payload['sourceRows']} rows")
