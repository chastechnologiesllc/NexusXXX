#!/usr/bin/env python3
from __future__ import annotations

import argparse
import html
import json
import re
import shutil
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

TERM_RE = re.compile(r"[^a-z0-9]+")
MIN_TERM_COUNT = 5
MAX_TERM_LENGTH = 64
INDEXABLE_MIN_COUNT = 20
CURATED_ALIASES = {
    "adult videos": ["amateur", "hardcore", "lesbian", "gay"],
    "free adult videos": ["amateur", "hardcore"],
    "free porn videos": ["amateur", "hardcore"],
    "porn videos": ["amateur", "hardcore"],
    "porn": ["amateur", "hardcore"],
    "sex videos": ["amateur", "hardcore", "lesbian", "gay"],
    "sex": ["amateur", "hardcore", "lesbian", "gay"],
    "xxx videos": ["amateur", "hardcore"],
    "xxx": ["amateur", "hardcore"],
    "adult sex videos": ["amateur", "hardcore"],
    "free porn": ["amateur", "hardcore"],
    "hd adult videos": ["amateur", "hardcore"],
    "popular porn": ["amateur", "big-ass", "babe"],
    "new porn videos": ["amateur", "hardcore"],
    "porn categories": [],
    "porn search": [],
    "sex search": [],
    "watch porn": ["amateur", "hardcore"],
    "adult video search": [],
}


def normalize_term(value: str) -> str:
    value = TERM_RE.sub(" ", value.lower()).strip()
    return re.sub(r"\s+", " ", value)


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "category"


def fmt_views(value: int) -> str:
    if value >= 1_000_000:
        return f"{value / 1_000_000:.1f}M"
    if value >= 1_000:
        return f"{value / 1_000:.1f}K"
    return str(value)


def watch_slug(video: dict[str, object]) -> str:
    title = slugify(str(video.get("title", "video")))
    video_id = re.sub(r"[^a-zA-Z0-9]+", "", str(video.get("id", "video"))).lower()
    return f"{title[:90]}-{video_id}".strip("-")


def origin_prefix(site_url: str) -> str:
    return site_url.rstrip("/") if site_url else ""


def url_for(path: str, site_url: str) -> str:
    clean = "/" + path.lstrip("/")
    return origin_prefix(site_url) + clean if site_url else clean


def build_keyword_index(catalog_root: Path, categories: list[dict[str, object]]) -> dict[str, object]:
    counts: Counter[str] = Counter()
    category_counts: dict[str, Counter[str]] = defaultdict(Counter)
    for entry in categories:
        slug = str(entry["slug"])
        for rel in entry["files"]:
            data = json.loads((catalog_root / rel).read_text(encoding="utf-8"))
            for video in data.get("videos", []):
                terms = {normalize_term(str(video.get("category", "")))}
                terms.update(normalize_term(str(tag)) for tag in video.get("tags", []))
                for term in terms:
                    if not term or len(term) > MAX_TERM_LENGTH or len(term) < 2:
                        continue
                    counts[term] += 1
                    category_counts[term][slug] += 1

    terms: dict[str, dict[str, object]] = {}
    for term, count in counts.items():
        if count < MIN_TERM_COUNT:
            continue
        categories_for_term = [slug for slug, _ in category_counts[term].most_common(8)]
        terms[term] = {"count": count, "categories": categories_for_term}

    for term, slugs in CURATED_ALIASES.items():
        if term not in terms:
            terms[term] = {"count": 0, "categories": slugs}
        else:
            terms[term]["categories"] = list(dict.fromkeys(list(slugs) + terms[term]["categories"]))[:8]

    return {
        "version": "1.0",
        "generated": date.today().isoformat(),
        "source": "catalog tags and canonical category names",
        "minimum_observed_count": MIN_TERM_COUNT,
        "term_count": len(terms),
        "terms": dict(sorted(terms.items())),
        "curated_aliases": CURATED_ALIASES,
    }


def page_html(entry: dict[str, object], top_videos: list[dict[str, object]], site_url: str) -> str:
    name = html.escape(str(entry["name"]))
    slug = str(entry["slug"])
    count = int(entry["count"])
    page_path = f"pages/category/{slug}.html"
    canonical = html.escape(url_for(page_path, site_url))
    description = html.escape(f"Browse {count:,} {entry['name']} adult videos on NexusXXX. Explore this category, related tags, and popular picks in the catalog.")
    title = html.escape(f"{entry['name']} Adult Videos | NexusXXX")
    og_image = html.escape(str(top_videos[0].get("thumb", "")), quote=True) if top_videos else ""
    item_list = []
    cards = []
    for position, video in enumerate(top_videos[:12], 1):
        video_id = html.escape(str(video.get("id", "")), quote=True)
        video_title = html.escape(str(video.get("title", "Video")))
        thumb = html.escape(str(video.get("thumb", "")), quote=True)
        video_path = f"pages/watch/{watch_slug(video)}.html"
        video_url = html.escape(url_for(video_path, site_url), quote=True)
        item_list.append({"@type": "ListItem", "position": position, "url": url_for(video_path, site_url), "name": str(video.get("title", "Video"))})
        cards.append(f'''<article class="seo-video-card"><a href="{video_url}"><img src="{thumb}" alt="" loading="lazy"><h2>{video_title}</h2><p>{html.escape(str(video.get("category", entry["name"]))) } · {fmt_views(int(video.get("views", 0)))} views</p></a></article>''')
    schema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": f"{entry['name']} Adult Videos",
        "description": html.unescape(description),
        "isPartOf": {"@type": "WebSite", "name": "NexusXXX", "url": origin_prefix(site_url) or "/"},
        "mainEntity": {"@type": "ItemList", "numberOfItems": count, "itemListElement": item_list},
    }
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <meta name="description" content="{description}">
  <meta name="robots" content="{'index, follow' if count >= INDEXABLE_MIN_COUNT else 'noindex, follow'}">
  <meta name="rating" content="adult">
  <link rel="canonical" href="{canonical}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="NexusXXX">
  <meta property="og:url" content="{canonical}">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{description}">
  <meta property="og:image" content="{og_image}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="{og_image}">
  <link rel="preconnect" href="https://www.pornhub.com" crossorigin>
  <link rel="preconnect" href="https://ei.phncdn.com" crossorigin>
  <link rel="dns-prefetch" href="//www.pornhub.com">
  <link rel="dns-prefetch" href="//ei.phncdn.com">
  <link rel="stylesheet" href="../../css/styles.css">
  <link rel="icon" href="../../assets/favicon.svg" type="image/svg+xml">
  <script type="application/ld+json">{json.dumps(schema, ensure_ascii=False)}</script>
</head>
<body class="seo-category">
  <header class="seo-category-header">
    <a href="../../index.html" class="logo">Nexus<span>XXX</span></a>
    <nav><a href="../../index.html">Home</a><a href="../categories.html">All categories</a><a href="../popular.html">Popular</a><a href="../newest.html">Newest</a></nav>
  </header>
  <main class="seo-category-main">
    <p class="seo-eyebrow">NexusXXX category</p>
    <h1>{name} Adult Videos</h1>
    <p class="seo-category-intro">Browse {count:,} videos in the {name} category. Use the catalog to discover popular picks, related tags, and more adult videos.</p>
    <p><a class="btn btn-primary" href="../../index.html?cat={html.escape(name, quote=True)}">Open the full {name} feed</a></p>
    <section class="seo-video-grid" aria-label="Featured {name} videos">{''.join(cards)}</section>
  </main>
</body>
</html>
'''


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--site-url", default="")
    parser.add_argument("--site-config", type=Path, default=Path("seo/site-config.json"))
    args = parser.parse_args()
    site_url = str(args.site_url).strip()
    if not site_url and args.site_config.exists():
        site_url = str(json.loads(args.site_config.read_text(encoding="utf-8")).get("siteUrl", "")).strip()

    index = json.loads((args.catalog / "index.json").read_text(encoding="utf-8"))
    categories = index["categories"]
    search_index = build_keyword_index(args.catalog, categories)
    search_dir = args.output_root / "js" / "search"
    search_dir.mkdir(parents=True, exist_ok=True)
    (search_dir / "index.json").write_text(json.dumps(search_index, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")

    category_dir = args.output_root / "pages" / "category"
    if category_dir.exists():
        shutil.rmtree(category_dir)
    category_dir.mkdir(parents=True)
    generated = 0
    indexable = 0
    for entry in categories:
        top_file = args.catalog / entry["files"][0]
        top_videos = json.loads(top_file.read_text(encoding="utf-8")).get("videos", [])
        slug = str(entry["slug"])
        (category_dir / f"{slug}.html").write_text(page_html(entry, top_videos, site_url), encoding="utf-8")
        generated += 1
        if int(entry["count"]) >= INDEXABLE_MIN_COUNT:
            indexable += 1

    seo_dir = args.output_root / "seo"
    seo_dir.mkdir(parents=True, exist_ok=True)
    config = {
        "siteUrl": site_url,
        "status": "domain-not-configured" if not site_url else "configured",
        "generated": date.today().isoformat(),
        "preferredHost": "apex",
        "redirects": {"http": "https", "www": "https://nexusxxx.site"} if site_url else {},
        "indexablePagePolicy": {"categoryMinimumRecords": INDEXABLE_MIN_COUNT, "featuredWatchPages": 1524, "searchQueryUrls": "noindex"},
        "replaceBeforeProductionIndexing": [] if site_url else ["robots.txt", "sitemap.xml", "canonical and Open Graph URLs"],
        "keywordPolicy": "Relevant tag/category intent mapping only; no hidden keyword blocks, keyword stuffing, or doorway pages.",
    }
    (seo_dir / "site-config.json").write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
    summary = {"term_count": search_index["term_count"], "category_pages": generated, "indexable_category_pages": indexable}
    (seo_dir / "build-summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
