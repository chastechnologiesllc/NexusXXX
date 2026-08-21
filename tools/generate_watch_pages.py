#!/usr/bin/env python3
"""Generate bounded, crawlable static watch pages from the featured catalog."""
from __future__ import annotations

import argparse
import html
import json
import re
import shutil
from pathlib import Path
from urllib.parse import urlparse


def load_featured(data_path: Path) -> list[dict[str, object]]:
    text = data_path.read_text(encoding="utf-8")
    match = re.search(r"const VIDEOS\s*=\s*(\[.*?\]);\s*\nconst CATEGORIES", text, re.S)
    if not match:
        raise SystemExit(f"Could not parse featured videos from {data_path}")
    videos = json.loads(match.group(1))
    if not isinstance(videos, list):
        raise SystemExit("Featured catalog is not a list")
    return [video for video in videos if isinstance(video, dict) and video.get("id") and video.get("title")]


def slugify(value: str) -> str:
    value = value.encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-") or "video"


def watch_slug(video: dict[str, object]) -> str:
    video_id = re.sub(r"[^a-zA-Z0-9]+", "", str(video.get("id", "video"))).lower()
    return f"{slugify(str(video.get('title', 'video')))[:90]}-{video_id}".strip("-")


def duration_iso(value: object) -> str | None:
    parts = str(value or "").split(":")
    try:
        numbers = [int(part) for part in parts]
    except ValueError:
        return None
    if len(numbers) == 2:
        minutes, seconds = numbers
        return f"PT{minutes}M{seconds}S"
    if len(numbers) == 3:
        hours, minutes, seconds = numbers
        return f"PT{hours}H{minutes}M{seconds}S"
    return None


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


def absolute(site_url: str, path: str) -> str:
    return site_url.rstrip("/") + "/" + path.lstrip("/")


def safe_embed(video: dict[str, object]) -> str:
    video_id = re.sub(r"[^a-zA-Z0-9]+", "", str(video.get("id", "")))
    return f"https://www.pornhub.com/embed/{video_id}"


def is_image_url(value: object) -> bool:
    url = str(value or '').strip()
    return bool(re.match(r'^https?://', url, re.I) and re.search(r'\.(?:jpe?g|png|webp|gif)(?:[/?#]|$)', url, re.I))


def page_html(video: dict[str, object], site_url: str) -> str:
    title_raw = str(video.get("title", "Video")).strip()
    title = html.escape(title_raw)
    category_raw = str(video.get("category", "Adult Videos")).strip() or "Adult Videos"
    category = html.escape(category_raw)
    category_slug = slugify(category_raw)
    thumb_raw = str(video.get("thumb", "")).strip()
    thumb_fallback_raw = str(video.get("thumbFallback", "")).strip()
    preview_images = list(dict.fromkeys(image for image in (thumb_raw, thumb_fallback_raw) if is_image_url(image)))[:2]
    thumb = html.escape(preview_images[0], quote=True) if preview_images else ""
    image_type = "image/png" if preview_images and re.search(r"\.png(?:[/?#]|$)", preview_images[0], re.I) else "image/jpeg"
    og_image_structured = (f'  <meta property="og:image:url" content="{thumb}">\n'
                           f'  <meta property="og:image:secure_url" content="{thumb}">\n'
                           f'  <meta property="og:image:type" content="{image_type}">\n'
                           f'  <meta property="og:image:width" content="320">\n'
                           f'  <meta property="og:image:height" content="240">\n'
                           f'  <meta property="og:image:alt" content="{title} video preview">') if preview_images else ""
    twitter_image_markup = (f'  <meta name="twitter:image" content="{thumb}">\n'
                            f'  <meta name="twitter:image:alt" content="{title} video preview">') if preview_images else ""
    embed = safe_embed(video)
    embed_html = html.escape(embed, quote=True)
    slug = watch_slug(video)
    path = f"pages/watch/{slug}.html"
    canonical = absolute(site_url, path)
    category_url = absolute(site_url, "pages/newest.html" if category_raw.lower() == "newest" else f"pages/category/{category_slug}.html")
    duration = str(video.get("duration", "")).strip()
    duration_markup = html.escape(duration)
    duration_schema = duration_iso(duration)
    try:
        views = int(video.get("views", 0) or 0)
    except (TypeError, ValueError):
        views = 0
    tags = [str(tag).strip() for tag in video.get("tags", []) if str(tag).strip()]
    tag_summary = ", ".join(tags[:12])
    description_raw = f'Watch "{title_raw}" on NexusXXX. Category: {category_raw}. Views: {fmt_views(views)}. Duration: {duration or "Not listed"}.'
    if tag_summary:
        description_raw += f" Tags: {tag_summary}."
    description = html.escape(description_raw, quote=True)
    schema: dict[str, object] = {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        "name": title_raw,
        "description": description_raw,
        "thumbnailUrl": preview_images,
        "embedUrl": embed,
        "url": canonical,
        "mainEntityOfPage": {"@type": "WebPage", "@id": canonical},
        "isFamilyFriendly": False,
        "inLanguage": "en",
        "genre": category_raw,
        "keywords": tags[:20],
        "publisher": {"@type": "Organization", "name": "NexusXXX", "url": site_url},
        "interactionStatistic": {
            "@type": "InteractionCounter",
            "interactionType": {"@type": "WatchAction"},
            "userInteractionCount": views,
        },
    }
    if duration_schema:
        schema["duration"] = duration_schema
    if not preview_images:
        schema.pop("thumbnailUrl", None)
    schema_json = json.dumps(schema, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    static_video_json = json.dumps(video, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    og_image_markup = "\n".join(
        f'  <meta property="og:image" content="{html.escape(image, quote=True)}">'
        for image in preview_images
    )
    og_duration = ""
    if duration_schema:
        try:
            og_seconds = sum(int(part) * multiplier for part, multiplier in zip(duration.split(":"), (3600, 60, 1)[-len(duration.split(":")):]))
            og_duration = f'\n  <meta property="og:video:duration" content="{og_seconds}">'
        except ValueError:
            pass
    tag_links = " ".join(html.escape(tag) for tag in tags[:12])
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta http-equiv="Content-Security-Policy" content="navigate-to 'self'; form-action 'self';">
  <title>{title} | NexusXXX</title>
  <meta name="description" content="{description}">
  <meta name="robots" content="index, follow">
  <meta name="rating" content="adult">
  <link rel="canonical" href="{html.escape(canonical, quote=True)}">
  <meta property="og:site_name" content="NexusXXX">
  <meta property="og:type" content="video.other">
  <meta property="og:url" content="{html.escape(canonical, quote=True)}">
  <meta property="og:title" content="{title} | NexusXXX">
  <meta property="og:description" content="{description}">
  <meta property="article:section" content="{category}">
  <meta name="keywords" content="{html.escape(", ".join([category_raw, *tags[:20]]), quote=True)}">
{og_image_markup}
{og_image_structured}
  <meta property="og:video" content="{embed_html}">
  <meta property="og:video:type" content="text/html">
  <meta property="og:video:secure_url" content="{embed_html}">
  <meta property="og:video:width" content="1280">
  <meta property="og:video:height" content="720">{og_duration}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{title} | NexusXXX">
  <meta name="twitter:description" content="{description}">
  <meta name="twitter:player" content="{html.escape(canonical, quote=True)}">
  <meta name="twitter:player:width" content="1280">
  <meta name="twitter:player:height" content="720">
{twitter_image_markup}
  <script type="application/ld+json">{schema_json}</script>
  <script>try {{ if (Number(localStorage.getItem('nexusxxx_age_verified_at') || '0') > Date.now() - 900000) document.documentElement.classList.add('age-verified'); }} catch (_) {{}}</script>
  <link rel="preconnect" href="https://www.pornhub.com" crossorigin>
  <link rel="preconnect" href="https://ei.phncdn.com" crossorigin>
  <link rel="dns-prefetch" href="//www.pornhub.com">
  <link rel="dns-prefetch" href="//ei.phncdn.com">
  <link rel="stylesheet" href="../../css/styles.css">
  <link rel="icon" href="../../assets/favicon.svg" type="image/svg+xml">
</head>
<body class="seo-category">
  <div id="age-gate" class="age-gate" role="dialog" aria-modal="true" aria-labelledby="age-gate-title">
    <div class="age-gate-box">
      <div class="age-language" aria-label="Language">◉ English</div>
      <div class="age-brand" aria-label="NexusXXX">Nexus<span>XXX</span></div>
      <p class="age-notice-label">This is an adult website</p>
      <h2 id="age-gate-title">Notice to Users</h2>
      <p class="age-gate-copy">This website contains age-restricted materials. By entering, you affirm that you are at least 18 or the age of majority where you access the website.</p>
      <div class="age-gate-buttons"><button id="age-enter" class="btn btn-primary">I am 18 or older - Enter</button><button id="age-exit" class="btn btn-secondary">I am under 18 - Exit</button></div>
    </div>
  </div>
  <header class="seo-category-header">
    <a href="{html.escape(absolute(site_url, 'index.html'), quote=True)}" class="logo">Nexus<span>XXX</span></a>
    <nav><a href="{html.escape(absolute(site_url, 'index.html'), quote=True)}">Home</a><a href="{html.escape(absolute(site_url, 'pages/categories.html'), quote=True)}">Categories</a><a href="{html.escape(absolute(site_url, 'pages/popular.html'), quote=True)}">Popular</a><a href="{html.escape(absolute(site_url, 'pages/newest.html'), quote=True)}">Newest</a></nav>
  </header>
  <main class="player-page seo-watch-page" id="player-root" data-video-id="{html.escape(str(video.get('id', '')), quote=True)}">
    <p class="seo-eyebrow">NexusXXX video</p>
    <div class="page-ad" data-ad="player-top">
      <div class="page-ad-label">Advertisement</div>
      <div class="page-ad-slot">Banner 320×50 / 728×90</div>
    </div>
    <div class="player-wrap" id="player-iframe">
      <iframe src="{embed_html}" title="{title} video player" loading="eager" referrerpolicy="no-referrer" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-fullscreen"></iframe>
    </div>
    <div class="page-ad" data-ad="player-mid">
      <div class="page-ad-label">Advertisement</div>
      <div class="page-ad-slot">Native / 300×250</div>
    </div>
    <div class="player-info">
      <h1>{title}</h1>
      <div class="player-meta"><span>{fmt_views(views)} views</span><span>{duration_markup}</span><a class="cat-pill" href="{html.escape(category_url, quote=True)}">{category}</a></div>
      <p class="seo-watch-copy">Watch this {html.escape(category_raw.lower())} adult video on NexusXXX. Browse more videos by category and discover related tags in the catalog.</p>
      <div class="share-row">
        <button class="btn-share" id="share-native" style="display:none">Share</button>
        <button class="btn-share" id="share-copy" disabled>Copy link</button>
      </div>
      <p class="seo-watch-tags" id="video-tags" aria-label="Video tags">{tag_links}</p>
    </div>
    <div class="page-ad" data-ad="player-related">
      <div class="page-ad-label">Advertisement</div>
      <div class="page-ad-slot">Banner / native</div>
    </div>
    <div class="related-section">
      <h3>Up next</h3>
      <div class="related-list" id="related-list"></div>
      <div class="load-more-wrap" id="related-load-more-wrap" style="display:none;padding:16px 0">
        <button id="related-load-more" class="btn btn-primary">Load more</button>
      </div>
    </div>
  </main>
  <footer class="site-footer"><div><a href="{html.escape(absolute(site_url, 'pages/terms.html'), quote=True)}">Terms</a><a href="{html.escape(absolute(site_url, 'pages/privacy.html'), quote=True)}">Privacy</a><a href="{html.escape(absolute(site_url, 'pages/dmca.html'), quote=True)}">DMCA</a></div><p>© 2026 NexusXXX. 18+ only.</p></footer>
  <div class="sticky-ad" id="sticky-ad">
    <button class="sticky-ad-close" id="sticky-ad-close" aria-label="Close">✕</button>
    <div class="ad-label">Advertisement</div>
    <div class="sticky-ad-slot" data-ad="sticky-banner">Bottom banner ad unit</div>
  </div>
  <script>window.__NEXUS_STATIC_VIDEO = {static_video_json};</script>
  <script src="../../js/data.js"></script>
  <script src="../../js/ad-config.js"></script>
  <script src="../../js/app.js"></script>
</body>
</html>
'''


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=Path("js/data.js"))
    parser.add_argument("--config", type=Path, default=Path("seo/site-config.json"))
    parser.add_argument("--output", type=Path, default=Path("pages/watch"))
    parser.add_argument("--summary", type=Path, default=Path("seo/watch-build-summary.json"))
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding="utf-8"))
    site_url = str(config.get("siteUrl", "")).strip().rstrip("/")
    if not site_url:
        raise SystemExit("seo/site-config.json must contain a public siteUrl")
    limit = args.limit or int(config.get("indexablePagePolicy", {}).get("featuredWatchPages", 1500))
    videos = load_featured(args.data)[:limit]
    if args.output.exists():
        shutil.rmtree(args.output)
    args.output.mkdir(parents=True, exist_ok=True)
    seen: set[str] = set()
    for video in videos:
        slug = watch_slug(video)
        if slug in seen:
            raise SystemExit(f"duplicate watch slug: {slug}")
        seen.add(slug)
        (args.output / f"{slug}.html").write_text(page_html(video, site_url), encoding="utf-8")
    summary = {"siteUrl": site_url, "watchPages": len(videos), "output": str(args.output)}
    args.summary.parent.mkdir(parents=True, exist_ok=True)
    args.summary.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
