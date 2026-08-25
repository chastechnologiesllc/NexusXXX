#!/usr/bin/env python3
"""Render a small, source-backed crawlable video discovery section on the homepage."""
from __future__ import annotations

import argparse
import html
import json
import re
from pathlib import Path

START = "  <!-- SEO_DISCOVERY_START -->"
END = "  <!-- SEO_DISCOVERY_END -->"


def load_featured(data_path: Path) -> list[dict[str, object]]:
    source = data_path.read_text(encoding="utf-8")
    match = re.search(r"const VIDEOS\s*=\s*(\[.*?\]);\s*const CATEGORIES", source, re.S)
    if not match:
        raise SystemExit(f"Could not parse featured videos from {data_path}")
    data = json.loads(match.group(1))
    if not isinstance(data, list):
        raise SystemExit("Featured data is not an array")
    return [item for item in data if isinstance(item, dict)]


def clean_slug(video: dict[str, object]) -> str:
    slug = re.sub(r"[^a-z0-9-]+", "-", str(video.get("slug", "video")).lower()).strip("-") or "video"
    ident = re.sub(r"[^a-zA-Z0-9]+", "", str(video.get("id", "video"))).lower() or "video"
    return f"{slug[:90]}-{ident}"


def render(videos: list[dict[str, object]], site_url: str) -> str:
    links = []
    for video in videos[:12]:
        title = str(video.get("title", "Video")).strip() or "Video"
        href = f"{site_url.rstrip('/')}/watch/{clean_slug(video)}.html"
        links.append(f'<li><a href="{html.escape(href, quote=True)}">{html.escape(title)}</a></li>')
    return "\n".join([
        START,
        '  <section class="home-seo-discovery" aria-labelledby="home-discovery-title">',
        '    <p class="home-seo-eyebrow">Explore the catalog</p>',
        '    <h2 id="home-discovery-title">Featured Free Adult Videos</h2>',
        '    <p>Browse a current selection of free adult videos with accurate titles, categories, durations, thumbnails, and related recommendations.</p>',
        '    <ul class="home-seo-link-list">',
        *[f"      {item}" for item in links],
        '    </ul>',
        '  </section>',
        END,
    ])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--page", type=Path, default=Path("index.html"))
    parser.add_argument("--data", type=Path, default=Path("js/data.js"))
    parser.add_argument("--site-url", default="https://nexusxxx.site")
    args = parser.parse_args()
    text = args.page.read_text(encoding="utf-8")
    block = render(load_featured(args.data), args.site_url)
    existing = re.compile(re.escape(START) + r".*?" + re.escape(END), re.S)
    if existing.search(text):
        text = existing.sub(block, text, count=1)
    else:
        anchor = '  <div class="feed-ad native-recommendation-ad"'
        if anchor not in text:
            raise SystemExit("homepage feed ad anchor not found")
        text = text.replace(anchor, block + "\n\n" + anchor, 1)
    args.page.write_text(text, encoding="utf-8")
    print(f"homepage_discovery_links={min(12, len(load_featured(args.data)))}")


if __name__ == "__main__":
    main()
