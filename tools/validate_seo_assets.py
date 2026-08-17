#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("."))
    args = parser.parse_args()
    root = args.root
    errors: list[str] = []
    index = json.loads((root / "js/catalog/index.json").read_text(encoding="utf-8"))
    search = json.loads((root / "js/search/index.json").read_text(encoding="utf-8"))

    if len(search.get("terms", {})) != int(search.get("term_count", -1)):
        errors.append("search term_count mismatch")
    if not search.get("terms"):
        errors.append("search index is empty")
    if "yourdomain.com" in (root / "robots.txt").read_text(encoding="utf-8"):
        errors.append("robots.txt still contains placeholder domain")
    if (root / "sitemap.xml").exists():
        errors.append("sitemap.xml exists before domain configuration")
    if not (root / "sitemap.template.xml").exists():
        errors.append("sitemap.template.xml missing")

    category_hub = (root / "pages/categories.html").read_text(encoding="utf-8")
    hub_links = set(re.findall(r'href="category/([a-z0-9-]+)\.html"', category_hub))
    expected_slugs = {str(entry["slug"]) for entry in index["categories"]}
    if hub_links != expected_slugs:
        errors.append(f"category hub links mismatch: {len(hub_links)} != {len(expected_slugs)}")

    pages = 0
    indexable = 0
    for entry in index["categories"]:
        slug = str(entry["slug"])
        path = root / "pages" / "category" / f"{slug}.html"
        if not path.is_file():
            errors.append(f"missing category page: {slug}")
            continue
        text = path.read_text(encoding="utf-8")
        pages += 1
        for marker in ("<title>", 'name="description"', 'rel="canonical"', 'application/ld+json', "<h1>", "seo-category-intro"):
            if marker not in text:
                errors.append(f"{slug}: missing {marker}")
        if 'content="index, follow"' in text:
            indexable += 1
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

    report = {
        "valid": not errors,
        "errors": errors,
        "search_terms": len(search.get("terms", {})),
        "category_pages": pages,
        "indexable_category_pages": indexable,
        "category_hub_links": len(hub_links),
        "categories": len(expected_slugs),
    }
    (root / "seo" / "validation-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if report["valid"] else 1)


if __name__ == "__main__":
    main()
