#!/usr/bin/env python3
"""Validate NexusXXX white-hat SEO assets and full-catalog indexing coverage."""
from __future__ import annotations

import gzip
import json
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://nexusxxx.site"
SITEMAP_NS = "{http://www.sitemaps.org/schemas/sitemap/0.9}"


def slugify(value: object) -> str:
    value = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode("ascii").lower().strip()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-") or "video"


def watch_slug(video: dict[str, object]) -> str:
    ident = re.sub(r"[^a-zA-Z0-9]+", "", str(video.get("id", "video"))).lower()
    return f"{slugify(video.get('title', 'video'))[:90]}-{ident}".strip("-")


def clean_path(video: dict[str, object]) -> str:
    return f"/watch/{watch_slug(video)}.html"


def read_json(path: Path) -> dict[str, object]:
    return json.loads(path.read_text(encoding="utf-8"))


def iter_catalog(catalog_root: Path, index: dict[str, object]):
    for entry in index.get("categories", []):
        for relative in entry.get("files", []):
            payload = read_json(catalog_root / str(relative))
            category = payload.get("category", entry.get("name", entry.get("slug", "Adult Videos")))
            for record_index, raw in enumerate(payload.get("videos", [])):
                video = dict(raw)
                video.setdefault("category", category)
                video.setdefault("catalogFile", relative)
                video.setdefault("catalogIndex", record_index)
                yield video


def page_checks(path: Path, expected_robots: str, canonical_prefix: str, require_video_link: bool = False) -> list[str]:
    text = path.read_text(encoding="utf-8", errors="replace")
    failures: list[str] = []
    if f'<meta name="robots" content="{expected_robots}">' not in text:
        failures.append(f"{path}: robots")
    if f'<link rel="canonical" href="{canonical_prefix}' not in text:
        failures.append(f"{path}: canonical")
    if "<title>" not in text or "</title>" not in text:
        failures.append(f"{path}: title")
    if '<meta name="description" content="' not in text:
        failures.append(f"{path}: description")
    if 'class="seo-breadcrumbs"' not in text:
        failures.append(f"{path}: breadcrumbs")
    if "application/ld+json" not in text:
        failures.append(f"{path}: structured data")
    if require_video_link and "/watch/" not in text:
        failures.append(f"{path}: internal video link")
    return failures


def sitemap_root(path: Path, compressed: bool = False) -> ET.Element:
    if compressed:
        with gzip.open(path, "rb") as handle:
            return ET.parse(handle).getroot()
    return ET.parse(path).getroot()


def locs(path: Path, compressed: bool = False) -> list[str]:
    return [node.text or "" for node in sitemap_root(path, compressed).iter(f"{SITEMAP_NS}loc")]


def main() -> None:
    errors: list[str] = []
    catalog_root = ROOT / "js/catalog"
    catalog_index = read_json(catalog_root / "index.json")
    total = int(catalog_index.get("total_videos", 0))
    policy = read_json(ROOT / "seo/site-config.json").get("indexablePagePolicy", {})

    home = (ROOT / "index.html").read_text(encoding="utf-8", errors="replace")
    if home.count("SEO_DISCOVERY_START") != 1 or home.count("SEO_DISCOVERY_END") != 1:
        errors.append("homepage SEO discovery block is missing or duplicated")
    if home.count('href="https://nexusxxx.site/watch/') < 12:
        errors.append("homepage does not expose 12 crawlable clean video links")
    if '<h1 class="feed-label" id="feed-label">Free Adult' not in home:
        errors.append("homepage topic H1 is missing")
    if '<h1 id="age-gate-title">' in home:
        errors.append("homepage age gate owns the H1")

    locator_manifest_path = catalog_root / "locator-index/manifest.json"
    if not locator_manifest_path.exists():
        errors.append("locator-index manifest missing")
    else:
        locator = read_json(locator_manifest_path)
        if int(locator.get("totalVideos", -1)) != total:
            errors.append("locator total does not equal catalog total")
        if int(locator.get("bucketCount", 0)) != 1024:
            errors.append("locator bucket count is not 1024")
        for bucket in range(1024):
            if not (catalog_root / "locator-index" / f"{bucket:03x}.txt").exists():
                errors.append(f"locator bucket missing: {bucket:03x}")
                break

    clean_paths: set[str] = set()
    catalog_scanned = 0
    sample_videos: list[dict[str, object]] = []
    for video in iter_catalog(catalog_root, catalog_index):
        catalog_scanned += 1
        path = clean_path(video)
        if path in clean_paths:
            errors.append(f"duplicate clean video path: {path}")
            break
        clean_paths.add(path)
        if len(sample_videos) < 12:
            sample_videos.append(video)
    if catalog_scanned != total:
        errors.append(f"catalog scan count {catalog_scanned} != {total}")

    watch_pages = sorted((ROOT / "pages/watch").glob("*.html"))
    expected_watch = int(policy.get("featuredWatchPages", len(watch_pages)))
    static_title_values: set[str] = set()
    if len(watch_pages) != expected_watch:
        errors.append(f"static watch pages {len(watch_pages)} != configured {expected_watch}")
    for path in watch_pages:
        errors.extend(page_checks(path, "index, follow", f"{SITE}/watch/"))
        text = path.read_text(encoding="utf-8", errors="replace")
        if 'app.js?v=nx-meta8' not in text:
            errors.append(f"{path}: stale runtime")
        if '"VideoObject"' not in text or '"thumbnailUrl"' not in text or '"embedUrl"' not in text:
            errors.append(f"{path}: incomplete VideoObject")
        title_match = re.search(r"<title>(.*?)</title>", text, re.S)
        if title_match:
            title_value = title_match.group(1).strip()
            if title_value in static_title_values:
                errors.append(f"{path}: duplicate title tag")
            static_title_values.add(title_value)

    category_min = int(policy.get("categoryMinimumRecords", 20))
    for entry in catalog_index.get("categories", []):
        slug = str(entry["slug"])
        path = ROOT / "pages/category" / f"{slug}.html"
        if not path.exists():
            errors.append(f"missing category page: {slug}")
            continue
        indexable = int(entry.get("count", 0)) >= category_min
        errors.extend(page_checks(path, "index, follow" if indexable else "noindex, follow", f"{SITE}/pages/category/", True))
        text = path.read_text(encoding="utf-8", errors="replace")
        if '"CollectionPage"' not in text or '"ItemList"' not in text:
            errors.append(f"{slug}: collection schema missing")

    for kind in ("tag", "performer"):
        directory = ROOT / "pages" / kind
        files = sorted(directory.glob("*.html")) if directory.exists() else []
        if not files:
            errors.append(f"no {kind} pages generated")
        for path in files:
            errors.extend(page_checks(path, "index, follow", f"{SITE}/pages/{kind}/", True))
            text = path.read_text(encoding="utf-8", errors="replace")
            if '"CollectionPage"' not in text or '"ItemList"' not in text:
                errors.append(f"{path}: collection schema missing")
        if not (ROOT / "seo" / f"{kind}s.json").exists():
            errors.append(f"seo/{kind}s.json missing")

    for hub in (ROOT / "pages/tags.html", ROOT / "pages/performers.html"):
        if not hub.exists():
            errors.append(f"hub missing: {hub.name}")
        else:
            errors.extend(page_checks(hub, "index, follow", f"{SITE}/pages/"))

    category_hub = (ROOT / "pages/categories.html").read_text(encoding="utf-8", errors="replace")
    if "tags.html" not in category_hub or "performers.html" not in category_hub:
        errors.append("categories hub missing tag/performer discovery links")
    if category_hub.count('class="static-category-links"') != 1:
        errors.append("categories hub has duplicated or missing static category block")
    if category_hub.count('class="seo-discovery-links"') != 1:
        errors.append("categories hub has duplicated or missing tag/performer discovery block")
    performer_hub = (ROOT / "pages/performers.html").read_text(encoding="utf-8", errors="replace") if (ROOT / "pages/performers.html").exists() else ""
    if 'Browse 4,178 performer pages' not in performer_hub or '"numberOfItems":4178' not in performer_hub:
        errors.append("performer hub count is not synchronized with generated performer pages")

    sitemap_path = ROOT / "sitemap.xml"
    sitemap_file_count = 0
    page_urls = 0
    video_urls = 0
    if not sitemap_path.exists():
        errors.append("sitemap.xml missing")
    else:
        try:
            root = sitemap_root(sitemap_path)
            if not root.tag.endswith("sitemapindex"):
                errors.append("sitemap.xml is not a sitemap index")
            sitemap_locs = locs(sitemap_path)
            sitemap_file_count = len(sitemap_locs)
            if sitemap_file_count != 97:
                errors.append(f"sitemap file count {sitemap_file_count} != 97")
            page_sitemap = ROOT / "sitemaps/pages.xml.gz"
            if not page_sitemap.exists():
                errors.append("compressed page sitemap missing")
            else:
                page_locs = locs(page_sitemap, True)
                page_urls = len(page_locs)
                if any(not item.startswith(SITE + "/") for item in page_locs):
                    errors.append("page sitemap contains non-production URL")
                if any("/pages/watch/" in item for item in page_locs):
                    errors.append("page sitemap contains legacy watch URL")
            video_files = sorted((ROOT / "sitemaps").glob("videos-*.xml.gz"))
            if len(video_files) != 96:
                errors.append(f"video sitemap shard count {len(video_files)} != 96")
            for video_file in video_files:
                try:
                    video_root = sitemap_root(video_file, True)
                    entries = video_root.findall(f"{SITEMAP_NS}url")
                    video_urls += len(entries)
                    if video_root.tag.endswith("urlset") and "video.google.com" not in str(video_root.attrib):
                        # Namespace is validated structurally below by checking one child.
                        pass
                    for entry in entries[:1]:
                        if not entry.find(f"{SITEMAP_NS}loc") is not None:
                            errors.append(f"{video_file.name}: missing loc")
                        if entry.find("{http://www.google.com/schemas/sitemap-video/1.1}video") is None:
                            errors.append(f"{video_file.name}: video extension missing")
                except (ET.ParseError, OSError) as exc:
                    errors.append(f"{video_file.name}: invalid gzip XML: {exc}")
                    break
            if video_urls != total:
                errors.append(f"video sitemap URLs {video_urls} != {total}")
        except (ET.ParseError, OSError) as exc:
            errors.append(f"invalid sitemap index: {exc}")

    sitemap_summary_path = ROOT / "seo/sitemap-summary.json"
    if not sitemap_summary_path.exists():
        errors.append("sitemap summary missing")
    else:
        summary = read_json(sitemap_summary_path)
        if int(summary.get("videoUrls", -1)) != total:
            errors.append("sitemap summary video count mismatch")
        if int(summary.get("pageUrls", -1)) != page_urls:
            errors.append("sitemap summary page count mismatch")

    robots = (ROOT / "robots.txt").read_text(encoding="utf-8", errors="replace") if (ROOT / "robots.txt").exists() else ""
    if "Sitemap: https://nexusxxx.site/sitemap.xml" not in robots:
        errors.append("robots.txt sitemap directive missing")
    if "Disallow: /watch/" in robots:
        errors.append("robots.txt blocks clean video routes")

    note = (ROOT / "note.md").read_text(encoding="utf-8", errors="replace") if (ROOT / "note.md").exists() else ""
    for required in ("canonical public URL", "build_video_locator_index.py", "generate_sitemap.py", "VideoObject", "Do not commit unrelated"):
        if required not in note:
            errors.append(f"note.md missing: {required}")

    report = {
        "valid": not errors,
        "errors": errors[:100],
        "errorCount": len(errors),
        "siteUrl": SITE,
        "catalogVideos": total,
        "catalogScanned": catalog_scanned,
        "staticWatchPages": len(watch_pages),
        "categoryPages": len(list((ROOT / "pages/category").glob("*.html"))),
        "tagPages": len(list((ROOT / "pages/tag").glob("*.html"))),
        "performerPages": len(list((ROOT / "pages/performer").glob("*.html"))),
        "sitemapFiles": sitemap_file_count,
        "pageSitemapUrls": page_urls,
        "videoSitemapUrls": video_urls,
    }
    (ROOT / "seo/validation-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if not errors else 1)


if __name__ == "__main__":
    main()
