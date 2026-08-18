#!/usr/bin/env python3
"""Audit representative catalog thumbnail and official embed endpoints."""

from __future__ import annotations

import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "js" / "data.js"
REPORT = ROOT / "docs" / "media-endpoint-audit.json"
text = DATA.read_text(encoding="utf-8")
thumbs = list(dict.fromkeys(re.findall(r'"thumb":"([^"]+)"', text)))[:12]
embeds = list(dict.fromkeys(re.findall(r'"embedSrc":"([^"]+)"', text)))[:12]


def check(url: str) -> dict[str, object]:
    try:
        response = requests.head(url, allow_redirects=True, timeout=15, headers={"User-Agent": "NexusXXX-media-audit/1.0"})
        return {"url": url, "status": response.status_code, "content_type": response.headers.get("content-type", ""), "final_url": response.url}
    except requests.RequestException as exc:
        return {"url": url, "error": str(exc)}

results: dict[str, list[dict[str, object]]] = {"thumbnails": [], "embeds": []}
with ThreadPoolExecutor(max_workers=8) as pool:
    futures = [("thumbnails", pool.submit(check, url)) for url in thumbs]
    futures += [("embeds", pool.submit(check, url)) for url in embeds]
    for kind, future in futures:
        results[kind].append(future.result())

report = {
    "sample_size": {"thumbnails": len(thumbs), "embeds": len(embeds)},
    "results": results,
}
REPORT.parent.mkdir(parents=True, exist_ok=True)
REPORT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, indent=2))
