#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path
from xml.sax.saxutils import escape

STATIC_PATHS = [
    "/",
    "/pages/categories.html",
    "/pages/popular.html",
    "/pages/newest.html",
    "/pages/2257.html",
]


def url(origin: str, path: str) -> str:
    return origin.rstrip("/") + "/" + path.lstrip("/")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=Path("seo/site-config.json"))
    parser.add_argument("--catalog", type=Path, default=Path("js/catalog/index.json"))
    parser.add_argument("--output", type=Path, default=Path("sitemap.xml"))
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding="utf-8"))
    origin = str(config.get("siteUrl", "")).strip()
    if not origin:
        raise SystemExit("siteUrl is empty; configure seo/site-config.json before generating sitemap.xml")
    index = json.loads(args.catalog.read_text(encoding="utf-8"))
    paths = list(STATIC_PATHS)
    paths.extend(f"/pages/category/{entry['slug']}.html" for entry in index["categories"] if int(entry["count"]) >= 20)
    lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for path in paths:
        priority = "1.0" if path == "/" else ("0.8" if "/category/" in path else "0.6")
        changefreq = "daily" if path in ("/", "/pages/popular.html", "/pages/newest.html") else "weekly"
        lines.extend([
            "  <url>",
            f"    <loc>{escape(url(origin, path))}</loc>",
            f"    <lastmod>{date.today().isoformat()}</lastmod>",
            f"    <changefreq>{changefreq}</changefreq>",
            f"    <priority>{priority}</priority>",
            "  </url>",
        ])
    lines.append("</urlset>")
    args.output.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"urls": len(paths), "output": str(args.output), "origin": origin}, indent=2))


if __name__ == "__main__":
    main()
