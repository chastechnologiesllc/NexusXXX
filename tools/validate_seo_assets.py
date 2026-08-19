#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from xml.etree import ElementTree


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("."))
    args = parser.parse_args()
    root = args.root
    errors: list[str] = []
    config = json.loads((root / "seo/site-config.json").read_text(encoding="utf-8"))
    site_url = str(config.get("siteUrl", "")).rstrip("/")
    if site_url != "https://nexusxxx.site":
        errors.append(f"unexpected siteUrl: {site_url}")

    index = json.loads((root / "js/catalog/index.json").read_text(encoding="utf-8"))
    search = json.loads((root / "js/search/index.json").read_text(encoding="utf-8"))
    if len(search.get("terms", {})) != int(search.get("term_count", -1)):
        errors.append("search term_count mismatch")
    if not search.get("terms"):
        errors.append("search index is empty")
    for term in ("sex", "porn", "sex videos", "porn videos", "watch porn"):
        if term not in search.get("terms", {}):
            errors.append(f"search alias missing: {term}")

    robots = (root / "robots.txt").read_text(encoding="utf-8")
    if f"Sitemap: {site_url}/sitemap.xml" not in robots:
        errors.append("robots.txt sitemap directive missing or wrong")
    if "yourdomain.com" in robots or "netlify.app" in robots:
        errors.append("robots.txt still contains staging/placeholder domain")

    sitemap_path = root / "sitemap.xml"
    sitemap_locs: set[str] = set()
    if not sitemap_path.is_file():
        errors.append("sitemap.xml missing")
    else:
        try:
            tree = ElementTree.parse(sitemap_path)
            sitemap_locs = {element.text or "" for element in tree.iter() if element.tag.endswith("loc")}
            if not sitemap_locs:
                errors.append("sitemap.xml has no URLs")
            for loc in sitemap_locs:
                if not loc.startswith(site_url + "/"):
                    errors.append(f"sitemap URL outside production origin: {loc}")
                if "/pages/video.html" in loc or "?q=" in loc or "?cat=" in loc:
                    errors.append(f"non-indexable utility URL in sitemap: {loc}")
        except ElementTree.ParseError as exc:
            errors.append(f"invalid sitemap.xml: {exc}")

    category_hub = (root / "pages/categories.html").read_text(encoding="utf-8")
    hub_links = set(re.findall(r'href="category/([a-z0-9-]+)\.html"', category_hub))
    expected_slugs = {str(entry["slug"]) for entry in index["categories"]}
    if hub_links != expected_slugs:
        errors.append(f"category hub links mismatch: {len(hub_links)} != {len(expected_slugs)}")

    category_pages = 0
    indexable_categories = 0
    for entry in index["categories"]:
        slug = str(entry["slug"])
        path = root / "pages" / "category" / f"{slug}.html"
        if not path.is_file():
            errors.append(f"missing category page: {slug}")
            continue
        text = path.read_text(encoding="utf-8")
        category_pages += 1
        for marker in ("<title>", 'name="description"', 'rel="canonical"', 'property="og:url"', 'application/ld+json', "<h1>", "seo-category-intro"):
            if marker not in text:
                errors.append(f"{slug}: missing {marker}")
        expected_canonical = f"{site_url}/pages/category/{slug}.html"
        if f'rel="canonical" href="{expected_canonical}"' not in text:
            errors.append(f"{slug}: canonical mismatch")
        is_indexable = 'content="index, follow"' in text
        if is_indexable:
            indexable_categories += 1
            if int(entry["count"]) < 20:
                errors.append(f"{slug}: thin category marked indexable")
            if expected_canonical not in sitemap_locs:
                errors.append(f"{slug}: indexable category missing from sitemap")
        elif int(entry["count"]) >= 20:
            errors.append(f"{slug}: substantive category marked noindex")
        if f"{int(entry['count']):,}" not in text:
            errors.append(f"{slug}: visible count missing")
        schema_match = re.search(r'<script type="application/ld\+json">(.*?)</script>', text, re.S)
        if not schema_match:
            errors.append(f"{slug}: schema missing")
        else:
            try:
                schema = json.loads(schema_match.group(1))
                if schema.get("@type") != "CollectionPage":
                    errors.append(f"{slug}: wrong schema type")
            except json.JSONDecodeError:
                errors.append(f"{slug}: invalid JSON-LD")

    watch_dir = root / "pages" / "watch"
    watch_pages = sorted(watch_dir.glob("*.html")) if watch_dir.exists() else []
    expected_watch_pages = int(config.get("indexablePagePolicy", {}).get("featuredWatchPages", 0))
    if len(watch_pages) != expected_watch_pages:
        errors.append(f"watch-page count mismatch: {len(watch_pages)} != {expected_watch_pages}")
    for path in watch_pages[:20]:
        text = path.read_text(encoding="utf-8")
        for marker in ("<title>", 'name="description"', 'rel="canonical"', 'property="og:url"', 'property="og:video"', 'twitter:image', '<h1>', 'class="player-wrap"', 'sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-fullscreen"'):
            if marker not in text:
                errors.append(f"{path.name}: missing {marker}")
        canonical = f"{site_url}/pages/watch/{path.name}"
        if f'rel="canonical" href="{canonical}"' not in text:
            errors.append(f"{path.name}: canonical mismatch")
        schema_match = re.search(r'<script type="application/ld\+json">(.*?)</script>', text, re.S)
        if not schema_match:
            errors.append(f"{path.name}: VideoObject schema missing")
        else:
            try:
                schema = json.loads(schema_match.group(1))
                if schema.get("@type") != "VideoObject":
                    errors.append(f"{path.name}: wrong schema type")
                if not schema.get("thumbnailUrl"):
                    errors.append(f"{path.name}: thumbnailUrl missing")
                if not schema.get("embedUrl"):
                    errors.append(f"{path.name}: embedUrl missing")
            except json.JSONDecodeError:
                errors.append(f"{path.name}: invalid VideoObject JSON-LD")
        if canonical not in sitemap_locs:
            errors.append(f"{path.name}: missing from sitemap")

    report = {
        "valid": not errors,
        "errors": errors,
        "site_url": site_url,
        "search_terms": len(search.get("terms", {})),
        "category_pages": category_pages,
        "indexable_category_pages": indexable_categories,
        "watch_pages": len(watch_pages),
        "sitemap_urls": len(sitemap_locs),
        "categories": len(expected_slugs),
    }
    (root / "seo" / "validation-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if report["valid"] else 1)


if __name__ == "__main__":
    main()
