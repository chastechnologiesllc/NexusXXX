#!/usr/bin/env python3
from __future__ import annotations

import argparse
import html
import json
import re
from pathlib import Path

PAGES = {
    "index.html": {
        "title": "Free Adult Videos | NexusXXX",
        "description": "Discover free adult videos on NexusXXX through curated categories, popular picks, newest uploads, and transparent search-based browsing.",
        "canonical": "/",
        "schema_type": "WebSite",
    },
    "pages/categories.html": {
        "title": "Adult Video Categories | NexusXXX",
        "description": "Browse NexusXXX adult video categories and explore relevant tags, curated picks, and popular videos in each section.",
        "canonical": "/pages/categories.html",
        "schema_type": "CollectionPage",
    },
    "pages/popular.html": {
        "title": "Popular Adult Videos | NexusXXX",
        "description": "Explore popular adult videos on NexusXXX, organized for fast browsing by category and search intent.",
        "canonical": "/pages/popular.html",
        "schema_type": "CollectionPage",
    },
    "pages/newest.html": {
        "title": "Newest Adult Videos | NexusXXX",
        "description": "Browse the newest adult videos available in the NexusXXX catalog, with category-aware navigation and search.",
        "canonical": "/pages/newest.html",
        "schema_type": "CollectionPage",
    },
    "pages/video.html": {
        "title": "Watch Adult Video | NexusXXX",
        "description": "Watch an adult video on NexusXXX with related categories, tags, and additional catalog recommendations.",
        "canonical": "/pages/video.html",
        "schema_type": "WebPage",
        "robots": "noindex, follow",
    },
}


def absolute_url(site_url: str, path: str) -> str:
    clean = "/" + path.lstrip("/")
    return site_url.rstrip("/") + clean if site_url else clean


def featured_thumbnail(data_path: Path) -> str:
    if not data_path.exists():
        return ""
    text = data_path.read_text(encoding="utf-8")
    match = re.search(r'"thumb":"([^"]+)"', text)
    return match.group(1) if match else ""


def extract(head: str, pattern: str) -> str:
    match = re.search(pattern, head, re.I)
    return match.group(0) if match else ""


def replace_or_add(head: str, pattern: str, replacement: str) -> str:
    if re.search(pattern, head, re.I):
        return re.sub(pattern, replacement, head, count=1, flags=re.I)
    return head.replace("</head>", replacement + "\n</head>")


def make_schema(path: str, meta: dict[str, str], catalog: dict[str, object], site_url: str) -> dict[str, object]:
    if meta["schema_type"] == "WebSite":
        return {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "NexusXXX",
            "description": meta["description"],
            "potentialAction": {"@type": "SearchAction", "target": {"@type": "EntryPoint", "urlTemplate": absolute_url(site_url, "?q={search_term_string}")}, "query-input": "required name=search_term_string"},
        }
    if meta["schema_type"] == "CollectionPage":
        item_list = []
        if path == "pages/categories.html":
            for position, entry in enumerate(catalog["categories"], 1):
                if int(entry["count"]) < 20:
                    continue
                item_list.append({"@type": "ListItem", "position": position, "name": entry["name"], "url": absolute_url(site_url, f"/pages/category/{entry['slug']}.html")})
        return {"@context": "https://schema.org", "@type": "CollectionPage", "name": meta["title"], "description": meta["description"], "url": absolute_url(site_url, meta["canonical"]), "mainEntity": {"@type": "ItemList", "numberOfItems": len(item_list), "itemListElement": item_list}}
    return {"@context": "https://schema.org", "@type": "WebPage", "name": meta["title"], "description": meta["description"], "url": absolute_url(site_url, meta["canonical"]), "isPartOf": {"@type": "WebSite", "name": "NexusXXX", "url": site_url}}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--catalog", type=Path, default=Path("js/catalog/index.json"))
    parser.add_argument("--config", type=Path, default=Path("seo/site-config.json"))
    parser.add_argument("--data", type=Path, default=Path("js/data.js"))
    args = parser.parse_args()
    catalog = json.loads(args.catalog.read_text(encoding="utf-8"))
    preview = featured_thumbnail(args.data)
    config = json.loads(args.config.read_text(encoding="utf-8")) if args.config.exists() else {}
    site_url = str(config.get("siteUrl", "")).strip().rstrip("/")
    for rel, meta in PAGES.items():
        path = args.root / rel
        text = path.read_text(encoding="utf-8")
        match = re.search(r"<head>(.*?)</head>", text, re.I | re.S)
        if not match:
            raise SystemExit(f"head not found: {rel}")
        old_head = match.group(1)
        stylesheet = extract(old_head, r'<link\s+rel=["\']stylesheet["\'][^>]*>')
        favicon = extract(old_head, r'<link\s+rel=["\']icon["\'][^>]*>')
        csp = extract(old_head, r'<meta\s+http-equiv=["\']Content-Security-Policy["\'][^>]*>')
        viewport = extract(old_head, r'<meta\s+name=["\']viewport["\'][^>]*>') or '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
        connection_hints = re.findall(r'<link\s+rel=["\'](?:preconnect|dns-prefetch)["\'][^>]*>', old_head, re.I)
        if not connection_hints:
            connection_hints = [
                '<link rel="preconnect" href="https://www.pornhub.com" crossorigin>',
                '<link rel="preconnect" href="https://ei.phncdn.com" crossorigin>',
                '<link rel="dns-prefetch" href="//www.pornhub.com">',
                '<link rel="dns-prefetch" href="//ei.phncdn.com">',
            ]
        inline_scripts = [script for script in re.findall(r'<script\b[^>]*>.*?</script>', old_head, re.I | re.S) if 'application/ld+json' not in script]
        schema = json.dumps(make_schema(rel, meta, catalog, site_url), ensure_ascii=False, separators=(",", ":"))
        canonical_url = absolute_url(site_url, meta["canonical"])
        head_parts = [
            '<meta charset="UTF-8">',
            viewport,
        ]
        if csp:
            head_parts.append(csp)
        head_parts.extend([
            f'<title>{meta["title"]}</title>',
            f'<meta name="description" content="{meta["description"]}">',
            f'<meta name="robots" content="{meta.get("robots", "index, follow")}">',
            '<meta name="rating" content="adult">',
            f'<link rel="canonical" href="{canonical_url}">',
            '<meta property="og:site_name" content="NexusXXX">',
            f'<meta property="og:url" content="{canonical_url}">',
            f'<meta property="og:title" content="{meta["title"]}">',
            f'<meta property="og:description" content="{meta["description"]}">',
            '<meta property="og:type" content="website">' if meta["schema_type"] != "WebPage" else '<meta property="og:type" content="video.other">',
            *( [f'<meta property="og:image" content="{html.escape(preview, quote=True)}">', f'<meta property="og:image:alt" content="NexusXXX video preview">', f'<meta name="twitter:image" content="{html.escape(preview, quote=True)}">', '<meta name="twitter:image:alt" content="NexusXXX video preview">'] if preview else [] ),
            '<meta name="twitter:card" content="summary_large_image">',
            f'<script type="application/ld+json">{schema}</script>',
            *connection_hints,
            *inline_scripts,
        ])
        if stylesheet:
            head_parts.append(stylesheet)
        if favicon:
            head_parts.append(favicon)
        new_head = "\n  " + "\n  ".join(head_parts) + "\n"
        path.write_text(text[:match.start(1)] + new_head + text[match.end(1):], encoding="utf-8")


if __name__ == "__main__":
    main()
