#!/usr/bin/env python3
"""Generate a sitemap index, page sitemap, and full-catalog video sitemaps."""
from __future__ import annotations

import argparse
import gzip
import html
import json
import re
import shutil
import unicodedata
from datetime import date
from pathlib import Path
from urllib.parse import quote

SITEMAP_LIMIT = 50_000
CATEGORY_MIN = 20
XMLNS = "http://www.sitemaps.org/schemas/sitemap/0.9"
VIDEO_NS = "http://www.google.com/schemas/sitemap-video/1.1"


def slugify(value: object) -> str:
    value = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode("ascii")
    value = value.lower().strip()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-") or "video"


def watch_slug(video: dict[str, object]) -> str:
    video_id = re.sub(r"[^a-zA-Z0-9]+", "", str(video.get("id", "video"))).lower()
    return f"{slugify(video.get('title', 'video'))[:90]}-{video_id}".strip("-")


def clean_video_path(video: dict[str, object]) -> str:
    return f"/watch/{watch_slug(video)}.html"


def url(origin: str, path: str) -> str:
    return origin.rstrip("/") + "/" + path.lstrip("/")


def preview_image_url(origin: str, image: object) -> str:
    return f"{origin.rstrip('/')}/preview-image?url={quote(str(image or '').strip(), safe='')}&v=play4"


def duration_seconds(value: object) -> int:
    parts = str(value or "").split(":")
    try:
        numbers = [int(part) for part in parts]
    except ValueError:
        return 0
    if any(number < 0 for number in numbers):
        return 0
    if len(numbers) == 3:
        return numbers[0] * 3600 + numbers[1] * 60 + numbers[2]
    if len(numbers) == 2:
        return numbers[0] * 60 + numbers[1]
    return 0


def clean_text(value: object, limit: int) -> str:
    cleaned = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", str(value or "").strip())
    return re.sub(r"\s+", " ", cleaned)[:limit]


def video_description(video: dict[str, object]) -> str:
    title = clean_text(video.get("title", "Video"), 240) or "Video"
    category = clean_text(video.get("category", "Adult Videos"), 80) or "Adult Videos"
    return f'Watch "{title}" in the {category} category on NexusXXX.'[:2048]


def iter_catalog_videos(catalog_root: Path, catalog: dict[str, object]):
    for entry in catalog.get("categories", []):
        for relative in entry.get("files", []):
            payload = json.loads((catalog_root / str(relative)).read_text(encoding="utf-8"))
            category = payload.get("category", entry.get("name", entry.get("slug", "Adult Videos")))
            for record_index, raw in enumerate(payload.get("videos", [])):
                video = dict(raw)
                video.setdefault("category", category)
                video.setdefault("catalogFile", relative)
                video.setdefault("catalogIndex", record_index)
                yield video


def write_gzip(path: Path, text: str) -> None:
    with gzip.open(path, "wt", encoding="utf-8", newline="\n") as handle:
        handle.write(text)


def page_priority(path: str) -> str:
    if path == "/":
        return "1.0"
    if path.startswith("/watch/"):
        return "0.8"
    if "/category/" in path or "/tag/" in path or "/performer/" in path:
        return "0.7"
    return "0.6"


def page_changefreq(path: str) -> str:
    return "daily" if path in ("/", "/pages/popular.html", "/pages/newest.html") else "weekly"


def write_page_sitemap(path: Path, origin: str, paths: list[str]) -> None:
    lines = [f'<?xml version="1.0" encoding="UTF-8"?>', f'<urlset xmlns="{XMLNS}">']
    for item in paths:
        lines.extend([
            "  <url>",
            f"    <loc>{html.escape(url(origin, item))}</loc>",
            f"    <lastmod>{date.today().isoformat()}</lastmod>",
            f"    <changefreq>{page_changefreq(item)}</changefreq>",
            f"    <priority>{page_priority(item)}</priority>",
            "  </url>",
        ])
    lines.append("</urlset>")
    write_gzip(path, "\n".join(lines) + "\n")


def write_video_sitemap(path: Path, origin: str, videos: list[dict[str, object]]) -> None:
    lines = [f'<?xml version="1.0" encoding="UTF-8"?>', f'<urlset xmlns="{XMLNS}" xmlns:video="{VIDEO_NS}">']
    for video in videos:
        title = clean_text(video.get("title", "Video"), 240) or "Video"
        thumb = str(video.get("thumb", "")).strip() or str(video.get("thumbFallback", "")).strip()
        if not thumb:
            continue
        video_id = re.sub(r"[^a-zA-Z0-9]+", "", str(video.get("id", "")))
        player = f"https://www.pornhub.com/embed/{video_id}"
        path_url = url(origin, clean_video_path(video))
        lines.extend([
            "  <url>",
            f"    <loc>{html.escape(path_url)}</loc>",
            "    <video:video>",
            f"      <video:thumbnail_loc>{html.escape(thumb)}</video:thumbnail_loc>",
            f"      <video:title><![CDATA[{title.replace(']]>', ']]]]><![CDATA[>')}]]></video:title>",
            f"      <video:description><![CDATA[{video_description(video).replace(']]>', ']]]]><![CDATA[>')}]]></video:description>",
            f"      <video:player_loc>{html.escape(player)}</video:player_loc>",
        ])
        seconds = duration_seconds(video.get("duration"))
        if 0 < seconds <= 28_800:
            lines.append(f"      <video:duration>{seconds}</video:duration>")
        lines.extend(["    </video:video>", "  </url>"])
    lines.append("</urlset>")
    write_gzip(path, "\n".join(lines) + "\n")


def write_index(path: Path, origin: str, sitemap_paths: list[str]) -> None:
    lines = [f'<?xml version="1.0" encoding="UTF-8"?>', f'<sitemapindex xmlns="{XMLNS}">']
    for sitemap_path in sitemap_paths:
        lines.extend(["  <sitemap>", f"    <loc>{html.escape(url(origin, sitemap_path))}</loc>", f"    <lastmod>{date.today().isoformat()}</lastmod>", "  </sitemap>"])
    lines.append("</sitemapindex>")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def page_paths(root: Path, catalog: dict[str, object]) -> list[str]:
    paths = ["/", "/pages/categories.html", "/pages/popular.html", "/pages/newest.html", "/pages/tags.html", "/pages/performers.html"]
    paths.extend(
        f"/pages/category/{entry['slug']}.html"
        for entry in catalog.get("categories", [])
        if int(entry.get("count", 0)) >= CATEGORY_MIN
    )
    for kind in ("tag", "performer"):
        directory = root / "pages" / kind
        if directory.exists():
            paths.extend(f"/pages/{kind}/{item.name}" for item in sorted(directory.glob("*.html")))
    return sorted(dict.fromkeys(paths))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=Path("seo/site-config.json"))
    parser.add_argument("--catalog", type=Path, default=Path("js/catalog/index.json"))
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--output", type=Path, default=Path("sitemap.xml"))
    parser.add_argument("--sitemap-dir", type=Path, default=Path("sitemaps"))
    parser.add_argument("--chunk-size", type=int, default=SITEMAP_LIMIT)
    args = parser.parse_args()
    if args.chunk_size <= 0 or args.chunk_size > SITEMAP_LIMIT:
        raise SystemExit(f"chunk-size must be between 1 and {SITEMAP_LIMIT}")
    config = json.loads(args.config.read_text(encoding="utf-8"))
    origin = str(config.get("siteUrl", "")).strip().rstrip("/")
    if not origin:
        raise SystemExit("siteUrl is empty; configure seo/site-config.json before generating sitemaps")
    catalog = json.loads(args.catalog.read_text(encoding="utf-8"))
    if args.sitemap_dir.exists():
        shutil.rmtree(args.sitemap_dir)
    args.sitemap_dir.mkdir(parents=True)

    page_file = args.sitemap_dir / "pages.xml.gz"
    pages = page_paths(args.root, catalog)
    write_page_sitemap(page_file, origin, pages)
    sitemap_paths = [f"/{args.sitemap_dir.name}/pages.xml.gz"]

    total_videos = 0
    video_sitemaps = 0
    chunk: list[dict[str, object]] = []
    for video in iter_catalog_videos(args.catalog.parent, catalog):
        if not str(video.get("id", "")).strip() or not str(video.get("title", "")).strip():
            continue
        chunk.append(video)
        total_videos += 1
        if len(chunk) >= args.chunk_size:
            name = f"videos-{video_sitemaps + 1:04d}.xml.gz"
            write_video_sitemap(args.sitemap_dir / name, origin, chunk)
            sitemap_paths.append(f"/{args.sitemap_dir.name}/{name}")
            video_sitemaps += 1
            chunk = []
    if chunk:
        name = f"videos-{video_sitemaps + 1:04d}.xml.gz"
        write_video_sitemap(args.sitemap_dir / name, origin, chunk)
        sitemap_paths.append(f"/{args.sitemap_dir.name}/{name}")
        video_sitemaps += 1

    write_index(args.output, origin, sitemap_paths)
    # Keep a named alias for operators and Search Console submissions.
    index_alias = args.root / "sitemap-index.xml"
    if index_alias != args.output:
        index_alias.write_text(args.output.read_text(encoding="utf-8"), encoding="utf-8")
    summary = {
        "generated": date.today().isoformat(),
        "origin": origin,
        "pageUrls": len(pages),
        "videoUrls": total_videos,
        "videoSitemaps": video_sitemaps,
        "sitemapFiles": len(sitemap_paths),
        "sitemapIndex": str(args.output),
        "videoSitemapNamespace": VIDEO_NS,
    }
    (args.root / "seo" / "sitemap-summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
