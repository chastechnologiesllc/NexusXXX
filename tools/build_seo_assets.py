"""Build crawlable white-hat SEO landing pages and search indexes.

The generator intentionally creates indexable tag and performer pages only when
there is substantial source coverage. It does not create doorway pages for every
low-volume query or fabricate performer metadata.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import html
import json
import re
import shutil
import unicodedata
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
from urllib.parse import quote

TERM_RE = re.compile(r"[^a-z0-9]+")
EMBED_RE = re.compile(r"/embed/([A-Za-z0-9]+)")
MIN_TERM_COUNT = 5
MAX_TERM_LENGTH = 64
INDEXABLE_MIN_COUNT = 20
INDEXABLE_TAG_MIN_COUNT = 50_000
INDEXABLE_PERFORMER_MIN_COUNT = 50
PLACEHOLDER_PERFORMERS = {"performer", "unknown", "anonymous", "n/a", "na", "none", "null"}
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
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = value.lower().strip()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-") or "page"


def display_term(value: str) -> str:
    return " ".join(word.upper() if len(word) <= 3 else word.capitalize() for word in value.split()) or value


def valid_performer_name(value: str) -> bool:
    return normalize_term(value) not in PLACEHOLDER_PERFORMERS and len(normalize_term(value)) >= 2


def unique_slug(value: str, used: dict[str, str]) -> str:
    base = slugify(value)
    previous = used.get(base)
    if previous is None or previous == value:
        used[base] = value
        return base
    suffix = hashlib.sha1(value.encode("utf-8")).hexdigest()[:8]
    candidate = f"{base}-{suffix}"
    if candidate in used and used[candidate] != value:
        raise SystemExit(f"unresolvable slug collision: {previous} and {value}")
    used[candidate] = value
    return candidate


def fmt_views(value: object) -> str:
    try:
        count = int(value or 0)
    except (TypeError, ValueError):
        count = 0
    if count >= 1_000_000:
        return f"{count / 1_000_000:.1f}M"
    if count >= 1_000:
        return f"{count / 1_000:.1f}K"
    return str(count)


def watch_slug(video: dict[str, object]) -> str:
    title = slugify(str(video.get("title", "video")))
    video_id = re.sub(r"[^a-zA-Z0-9]+", "", str(video.get("id", "video"))).lower()
    return f"{title[:90]}-{video_id}".strip("-")


def clean_video_path(video: dict[str, object]) -> str:
    return f"/watch/{watch_slug(video)}.html"


def origin_prefix(site_url: str) -> str:
    return site_url.rstrip("/") if site_url else ""


def url_for(path: str, site_url: str) -> str:
    clean = "/" + path.lstrip("/")
    return origin_prefix(site_url) + clean if site_url else clean


def preview_image_url(site_url: str, image: str) -> str:
    return f"{origin_prefix(site_url)}/preview-image?url={quote(image, safe='')}&v=play4"


def is_image_url(value: object) -> bool:
    return bool(re.match(r"^https?://", str(value or "").strip(), re.I))


def video_terms(video: dict[str, object]) -> set[str]:
    terms = {normalize_term(str(video.get("category", "")))}
    terms.update(normalize_term(str(tag)) for tag in video.get("tags", []) if str(tag).strip())
    return {term for term in terms if MIN_TERM_COUNT <= len(term) <= MAX_TERM_LENGTH}


def build_keyword_index(catalog_root: Path, categories: list[dict[str, object]]) -> dict[str, object]:
    counts: Counter[str] = Counter()
    category_counts: dict[str, Counter[str]] = defaultdict(Counter)
    for entry in categories:
        category_slug = str(entry["slug"])
        for rel in entry["files"]:
            data = json.loads((catalog_root / rel).read_text(encoding="utf-8"))
            for video in data.get("videos", []):
                for term in video_terms(video):
                    counts[term] += 1
                    category_counts[term][category_slug] += 1

    terms: dict[str, dict[str, object]] = {}
    for term, count in counts.items():
        if count < MIN_TERM_COUNT:
            continue
        terms[term] = {
            "count": count,
            "categories": [slug for slug, _ in category_counts[term].most_common(8)],
        }
    for term, slugs in CURATED_ALIASES.items():
        if term not in terms:
            terms[term] = {"count": 0, "categories": slugs}
        else:
            terms[term]["categories"] = list(dict.fromkeys(list(slugs) + terms[term]["categories"]))[:8]
    return {
        "version": "2.0",
        "generated": date.today().isoformat(),
        "source": "catalog tags and canonical category names",
        "minimum_observed_count": MIN_TERM_COUNT,
        "term_count": len(terms),
        "terms": dict(sorted(terms.items())),
        "curated_aliases": CURATED_ALIASES,
    }


def top_videos_for_terms(catalog_root: Path, categories: list[dict[str, object]], selected: set[str], limit: int = 12) -> dict[str, list[dict[str, object]]]:
    found: dict[str, list[dict[str, object]]] = defaultdict(list)
    for entry in categories:
        for rel in entry["files"]:
            data = json.loads((catalog_root / rel).read_text(encoding="utf-8"))
            for record_index, raw_video in enumerate(data.get("videos", [])):
                video = dict(raw_video)
                video.setdefault("category", data.get("category", entry.get("name", entry["slug"])))
                video.setdefault("catalogFile", rel)
                video.setdefault("catalogIndex", record_index)
                matched = video_terms(video) & selected
                for term in matched:
                    bucket = found[term]
                    bucket.append(video)
                    bucket.sort(key=lambda item: (-int(item.get("views", 0) or 0), str(item.get("id", ""))))
                    if len(bucket) > limit:
                        del bucket[limit:]
    return dict(found)


def category_breadcrumb(name: str, page_path: str, site_url: str, parent_label: str, parent_path: str) -> tuple[str, dict[str, object]]:
    canonical = url_for(page_path, site_url)
    markup = f'''<nav class="seo-breadcrumbs" aria-label="Breadcrumb"><a href="{html.escape(url_for('/', site_url), quote=True)}">Home</a><span aria-hidden="true">›</span><a href="{html.escape(url_for(parent_path, site_url), quote=True)}">{html.escape(parent_label)}</a><span aria-hidden="true">›</span><span aria-current="page">{html.escape(name)}</span></nav>'''
    schema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": url_for("/", site_url)},
            {"@type": "ListItem", "position": 2, "name": parent_label, "item": url_for(parent_path, site_url)},
            {"@type": "ListItem", "position": 3, "name": name, "item": canonical},
        ],
    }
    return markup, schema


def video_cards(videos: list[dict[str, object]], site_url: str) -> str:
    cards: list[str] = []
    for video in videos[:12]:
        title = str(video.get("title", "Video")).strip() or "Video"
        category = str(video.get("category", "Adult Videos")).strip() or "Adult Videos"
        thumb = str(video.get("thumb", "")).strip()
        image = preview_image_url(site_url, thumb) if is_image_url(thumb) else ""
        image_markup = f'<img src="{html.escape(image, quote=True)}" alt="{html.escape(title, quote=True)} video thumbnail" loading="lazy">' if image else ""
        cards.append(
            f'<article class="seo-video-card"><a href="{html.escape(url_for(clean_video_path(video), site_url), quote=True)}">'
            f'{image_markup}<h2>{html.escape(title)}</h2><p>{html.escape(category)} · {fmt_views(video.get("views", 0))} views</p></a></article>'
        )
    return "".join(cards)


def collection_html(*, name: str, page_path: str, parent_label: str, parent_path: str, count: int, description: str, videos: list[dict[str, object]], site_url: str, schema_about: dict[str, object] | None = None, indexable: bool = True) -> str:
    canonical = url_for(page_path, site_url)
    title = f"{name} Adult Videos | NexusXXX"
    breadcrumb_markup, breadcrumb_schema = category_breadcrumb(name, page_path, site_url, parent_label, parent_path)
    schema: dict[str, object] = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": title,
        "description": description,
        "url": canonical,
        "isPartOf": {"@type": "WebSite", "name": "NexusXXX", "url": origin_prefix(site_url) or "/"},
        "mainEntity": {
            "@type": "ItemList",
            "numberOfItems": count,
            "itemListElement": [
                {"@type": "ListItem", "position": index, "url": url_for(clean_video_path(video), site_url), "name": str(video.get("title", "Video"))}
                for index, video in enumerate(videos[:12], 1)
            ],
        },
        "breadcrumb": {"@id": canonical + "#breadcrumb"},
    }
    if schema_about:
        schema["about"] = schema_about
    schema_json = json.dumps(schema, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    breadcrumb_schema["@id"] = canonical + "#breadcrumb"
    breadcrumb_json = json.dumps(breadcrumb_schema, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{html.escape(title)}</title>
  <meta name="description" content="{html.escape(description, quote=True)}">
  <meta name="robots" content="{'index, follow' if indexable else 'noindex, follow'}">
  <meta name="rating" content="adult">
  <link rel="canonical" href="{html.escape(canonical, quote=True)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="NexusXXX">
  <meta property="og:url" content="{html.escape(canonical, quote=True)}">
  <meta property="og:title" content="{html.escape(title, quote=True)}">
  <meta property="og:description" content="{html.escape(description, quote=True)}">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">{schema_json}</script>
  <script type="application/ld+json">{breadcrumb_json}</script>
  <link rel="stylesheet" href="../../css/styles.css?v=nx-20260821-ads">
  <link rel="icon" href="../../assets/favicon.svg" type="image/svg+xml">
</head>
<body class="seo-category">
  <header class="seo-category-header"><a href="{html.escape(url_for('/', site_url), quote=True)}" class="logo">Nexus<span>XXX</span></a><nav><a href="{html.escape(url_for('/', site_url), quote=True)}">Home</a><a href="{html.escape(url_for('/pages/categories.html', site_url), quote=True)}">Categories</a><a href="{html.escape(url_for('/pages/tags.html', site_url), quote=True)}">Tags</a><a href="{html.escape(url_for('/pages/performers.html', site_url), quote=True)}">Performers</a><a href="{html.escape(url_for('/pages/popular.html', site_url), quote=True)}">Popular</a></nav></header>
  <main class="seo-category-main">
    {breadcrumb_markup}
    <p class="seo-eyebrow">NexusXXX {html.escape(parent_label.lower())}</p>
    <h1>{html.escape(name)} Adult Videos</h1>
    <p class="seo-category-intro">{html.escape(description)}</p>
    <p><a class="btn btn-primary" href="{html.escape(url_for(parent_path, site_url), quote=True)}">Browse more {html.escape(parent_label.lower())}</a></p>
    <section class="seo-video-grid" aria-label="Featured {html.escape(name)} videos">{video_cards(videos, site_url)}</section>
  </main>
</body>
</html>
'''


def build_performer_index(source_root: Path, catalog_index: dict[str, object], threshold: int) -> dict[str, dict[str, object]]:
    counts: Counter[str] = Counter()
    csv_files = sorted(source_root.rglob("part-*.csv")) if source_root.exists() else []
    for path in csv_files:
        with path.open("r", encoding="utf-8", errors="replace", newline="") as handle:
            for row in csv.reader(handle, delimiter="|"):
                if len(row) != 13:
                    continue
                names = {name.strip() for name in re.split(r"\s*;\s*", row[6]) if name.strip() and valid_performer_name(name)}
                for name in names:
                    counts[name] += 1
    selected = {name for name, count in counts.items() if count >= threshold}
    records: dict[str, list[dict[str, object]]] = defaultdict(list)
    category_names = {str(entry["slug"]): str(entry["name"]) for entry in catalog_index.get("categories", [])}
    for path in csv_files:
        source_slug = path.parent.name
        category = category_names.get(source_slug, display_term(source_slug))
        with path.open("r", encoding="utf-8", errors="replace", newline="") as handle:
            for row in csv.reader(handle, delimiter="|"):
                if len(row) != 13:
                    continue
                names = {name.strip() for name in re.split(r"\s*;\s*", row[6]) if name.strip() and valid_performer_name(name)} & selected
                if not names:
                    continue
                match = EMBED_RE.search(row[0])
                if not match or not row[3].strip():
                    continue
                try:
                    views = max(0, int(row[8] or 0))
                except ValueError:
                    views = 0
                thumb = row[11].strip() or row[1].strip()
                video = {
                    "id": match.group(1),
                    "title": row[3].strip(),
                    "category": category,
                    "thumb": thumb,
                    "thumbFallback": row[1].strip(),
                    "duration": row[7].strip(),
                    "views": views,
                    "tags": [tag.strip() for tag in (row[4] + ";" + row[5]).split(";") if tag.strip()][:20],
                }
                for name in names:
                    bucket = records[name]
                    bucket.append(video)
                    bucket.sort(key=lambda item: (-int(item.get("views", 0)), str(item.get("id", ""))))
                    if len(bucket) > 12:
                        del bucket[12:]
    return {name: {"count": counts[name], "videos": records.get(name, [])} for name in sorted(selected, key=lambda item: (-counts[item], item.lower()))}


def write_hub(path: Path, page_path: str, title: str, description: str, links: list[tuple[str, str]], site_url: str) -> None:
    canonical = url_for(page_path, site_url)
    items = "".join(f'<li><a href="{html.escape(href, quote=True)}">{html.escape(label)}</a></li>' for label, href in links)
    schema = {"@context": "https://schema.org", "@type": "CollectionPage", "name": title, "description": description, "url": canonical, "mainEntity": {"@type": "ItemList", "numberOfItems": len(links)}}
    path.write_text(f'''<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>{html.escape(title)}</title><meta name="description" content="{html.escape(description, quote=True)}"><meta name="robots" content="index, follow"><link rel="canonical" href="{html.escape(canonical, quote=True)}"><script type="application/ld+json">{json.dumps(schema, ensure_ascii=False, separators=(",", ":"))}</script><link rel="stylesheet" href="../css/styles.css?v=nx-20260821-ads"></head><body class="seo-category"><header class="seo-category-header"><a href="{html.escape(url_for('/', site_url), quote=True)}" class="logo">Nexus<span>XXX</span></a></header><main class="seo-category-main"><nav class="seo-breadcrumbs" aria-label="Breadcrumb"><a href="{html.escape(url_for('/', site_url), quote=True)}">Home</a><span aria-hidden="true">›</span><span aria-current="page">{html.escape(title.split(" | ")[0])}</span></nav><h1>{html.escape(title.split(" | ")[0])}</h1><p class="seo-category-intro">{html.escape(description)}</p><ul class="seo-index-list">{items}</ul></main></body></html>''', encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--site-url", default="")
    parser.add_argument("--site-config", type=Path, default=Path("seo/site-config.json"))
    parser.add_argument("--source-csv-root", type=Path, default=Path("data/pornhub-db-split/categories"))
    parser.add_argument("--tag-min", type=int, default=INDEXABLE_TAG_MIN_COUNT)
    parser.add_argument("--performer-min", type=int, default=INDEXABLE_PERFORMER_MIN_COUNT)
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
    for entry in categories:
        top_file = args.catalog / entry["files"][0]
        top_data = json.loads(top_file.read_text(encoding="utf-8"))
        top_videos = []
        for record_index, raw in enumerate(top_data.get("videos", [])[:12]):
            video = dict(raw)
            video.setdefault("catalogFile", entry["files"][0])
            video.setdefault("catalogIndex", record_index)
            top_videos.append(video)
        count = int(entry["count"])
        description = f"Browse {count:,} {entry['name']} adult videos on NexusXXX. Explore accurate titles, thumbnails, durations, views, related tags, and curated recommendations in this category."
        page = collection_html(name=str(entry["name"]), page_path=f"/pages/category/{entry['slug']}.html", parent_label="Categories", parent_path="/pages/categories.html", count=count, description=description, videos=top_videos, site_url=site_url, indexable=count >= INDEXABLE_MIN_COUNT)
        (category_dir / f"{entry['slug']}.html").write_text(page, encoding="utf-8")

    selected_tags = {term for term, value in search_index["terms"].items() if int(value.get("count", 0)) >= args.tag_min}
    tag_videos = top_videos_for_terms(args.catalog, categories, selected_tags)
    tag_dir = args.output_root / "pages" / "tag"
    if tag_dir.exists():
        shutil.rmtree(tag_dir)
    tag_dir.mkdir(parents=True)
    tag_records: dict[str, object] = {}
    tag_slugs: dict[str, str] = {}
    for term in sorted(selected_tags):
        count = int(search_index["terms"][term]["count"])
        name = display_term(term)
        tag_slug = unique_slug(term, tag_slugs)
        description = f"Browse {count:,} adult videos tagged {name} on NexusXXX. Compare relevant titles, categories, durations, views, thumbnails, and related recommendations."
        page = collection_html(name=name, page_path=f"/pages/tag/{tag_slug}.html", parent_label="Tags", parent_path="/pages/tags.html", count=count, description=description, videos=tag_videos.get(term, []), site_url=site_url, schema_about={"@type": "Thing", "name": name})
        (tag_dir / f"{tag_slug}.html").write_text(page, encoding="utf-8")
        tag_records[term] = {"slug": tag_slug, "count": count, "videos": tag_videos.get(term, [])}

    performer_records = build_performer_index(args.source_csv_root, index, args.performer_min)
    performer_dir = args.output_root / "pages" / "performer"
    if performer_dir.exists():
        shutil.rmtree(performer_dir)
    performer_dir.mkdir(parents=True)
    performer_slugs: dict[str, str] = {}
    for name, record in performer_records.items():
        slug = unique_slug(name, performer_slugs)
        count = int(record["count"])
        description = f"Browse {count:,} adult videos featuring {name} on NexusXXX. Explore the performer’s indexed video catalog with accurate titles, thumbnails, categories, durations, and view counts."
        page = collection_html(name=name, page_path=f"/pages/performer/{slug}.html", parent_label="Performers", parent_path="/pages/performers.html", count=count, description=description, videos=record["videos"], site_url=site_url, schema_about={"@type": "Person", "name": name})
        (performer_dir / f"{slug}.html").write_text(page, encoding="utf-8")

    pages_dir = args.output_root / "pages"
    tag_links = [(display_term(term), url_for(f"/pages/tag/{tag_records[term]['slug']}.html", site_url)) for term in sorted(selected_tags)]
    performer_links = [(name, url_for(f"/pages/performer/{slug}.html", site_url)) for slug, name in performer_slugs.items()]
    write_hub(pages_dir / "tags.html", "/pages/tags.html", "Video Tags | NexusXXX", f"Browse {len(tag_links):,} high-volume video tag pages on NexusXXX, each with distinct descriptions and curated examples.", tag_links, site_url)
    write_hub(pages_dir / "performers.html", "/pages/performers.html", "Video Performers | NexusXXX", f"Browse {len(performer_links):,} performer pages on NexusXXX with source-backed video counts and curated examples.", performer_links, site_url)

    seo_dir = args.output_root / "seo"
    seo_dir.mkdir(parents=True, exist_ok=True)
    (seo_dir / "tags.json").write_text(json.dumps(tag_records, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    (seo_dir / "performers.json").write_text(json.dumps(performer_records, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    config = {
        "siteUrl": site_url,
        "status": "domain-not-configured" if not site_url else "configured",
        "generated": date.today().isoformat(),
        "preferredHost": "apex",
        "redirects": {"http": "https", "www": "https://nexusxxx.site"} if site_url else {},
        "indexablePagePolicy": {
            "categoryMinimumRecords": INDEXABLE_MIN_COUNT,
            "tagMinimumRecords": args.tag_min,
            "performerMinimumRecords": args.performer_min,
            "featuredWatchPages": int(index.get("featured_count", 1500)),
            "fullCatalogVideoPages": int(index.get("total_videos", 0)),
            "searchQueryUrls": "noindex",
            "canonicalVideoRoute": "/watch/{slug}-{id}.html",
        },
        "replaceBeforeProductionIndexing": [] if site_url else ["robots.txt", "sitemap.xml", "canonical and Open Graph URLs"],
        "keywordPolicy": "Relevant tag/category/performer intent mapping only; no hidden keyword blocks, keyword stuffing, or doorway pages.",
    }
    (seo_dir / "site-config.json").write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
    summary = {
        "term_count": search_index["term_count"],
        "category_pages": len(categories),
        "indexable_category_pages": sum(int(entry["count"]) >= INDEXABLE_MIN_COUNT for entry in categories),
        "tag_pages": len(tag_records),
        "performer_pages": len(performer_records),
        "full_catalog_video_pages": int(index.get("total_videos", 0)),
    }
    (seo_dir / "build-summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
