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
]


def url(origin: str, path: str) -> str:
    return origin.rstrip("/") + "/" + path.lstrip("/")


def discover_paths(root: Path, catalog: dict[str, object]) -> list[str]:
    paths = list(STATIC_PATHS)
    paths.extend(
        f"/pages/category/{entry['slug']}.html"
        for entry in catalog.get("categories", [])
        if int(entry.get("count", 0)) >= 20
    )
    watch_dir = root / "pages" / "watch"
    if watch_dir.exists():
        paths.extend(
            "/pages/watch/" + path.name
            for path in sorted(watch_dir.glob("*.html"))
            if path.name != "index.html"
        )
    return paths


def page_priority(path: str) -> str:
    if path == "/":
        return "1.0"
    if path.startswith("/pages/watch/"):
        return "0.8"
    if "/category/" in path:
        return "0.7"
    return "0.6"


def page_changefreq(path: str) -> str:
    if path in ("/", "/pages/popular.html", "/pages/newest.html"):
        return "daily"
    return "weekly"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=Path("seo/site-config.json"))
    parser.add_argument("--catalog", type=Path, default=Path("js/catalog/index.json"))
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--output", type=Path, default=Path("sitemap.xml"))
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding="utf-8"))
    origin = str(config.get("siteUrl", "")).strip()
    if not origin:
        raise SystemExit("siteUrl is empty; configure seo/site-config.json before generating sitemap.xml")
    index = json.loads(args.catalog.read_text(encoding="utf-8"))
    paths = discover_paths(args.root, index)
    lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for path in paths:
        lines.extend([
            "  <url>",
            f"    <loc>{escape(url(origin, path))}</loc>",
            f"    <lastmod>{date.today().isoformat()}</lastmod>",
            f"    <changefreq>{page_changefreq(path)}</changefreq>",
            f"    <priority>{page_priority(path)}</priority>",
            "  </url>",
        ])
    lines.append("</urlset>")
    args.output.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"urls": len(paths), "output": str(args.output), "origin": origin}, indent=2))


if __name__ == "__main__":
    main()
