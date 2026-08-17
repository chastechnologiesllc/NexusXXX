#!/usr/bin/env python3
from __future__ import annotations

import argparse
import html
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--page", type=Path, default=Path("pages/categories.html"))
    parser.add_argument("--catalog", type=Path, default=Path("js/catalog/index.json"))
    args = parser.parse_args()
    text = args.page.read_text(encoding="utf-8")
    index = json.loads(args.catalog.read_text(encoding="utf-8"))
    links = []
    for entry in index["categories"]:
        name = html.escape(str(entry["name"]))
        slug = html.escape(str(entry["slug"]), quote=True)
        count = f"{int(entry['count']):,}"
        links.append(f'<a class="cat-card" href="category/{slug}.html"><span>{name}</span><small>{count} videos</small></a>')
    block = '<nav class="static-category-links" aria-label="Adult video categories">\n' + "\n".join(links) + "\n</nav>"
    marker = '<div class="cat-grid" id="category-grid"></div>'
    if marker not in text:
        raise SystemExit("category grid marker not found")
    text = text.replace(marker, marker + "\n    " + block, 1)
    args.page.write_text(text, encoding="utf-8")
    print(f"category_links={len(links)}")


if __name__ == "__main__":
    main()
