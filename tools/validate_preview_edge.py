#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
app = (ROOT / "js/app.js").read_text(encoding="utf-8")
template = (ROOT / "pages/video.html").read_text(encoding="utf-8")
generator = (ROOT / "tools/generate_watch_pages.py").read_text(encoding="utf-8")
edge_path = ROOT / "netlify/edge-functions/video-preview.ts"
proxy_path = ROOT / "netlify/edge-functions/preview-image.ts"
edge = edge_path.read_text(encoding="utf-8") if edge_path.exists() else ""
proxy = proxy_path.read_text(encoding="utf-8") if proxy_path.exists() else ""
part = json.loads((ROOT / "js/catalog/brazilian/part-0001.json").read_text(encoding="utf-8"))
record = next((video for video in part.get("videos", []) if video.get("id") == "ph5e6d9d48d0bbf"), None)

checks = [
    ("Netlify edge preview handler exists", edge_path.exists()),
    ("edge handler targets dynamic video route", 'path: "/pages/video.html"' in edge),
    ("edge handler returns static fallback when unresolved", "context.next()" in edge),
    ("edge handler loads catalog by validated locator", "CATALOG_RE" in edge and "catalogUrl" in edge and "record" in edge),
    ("legacy screenshot ID has an exact locator", 'ph5e6d9d48d0bbf' in edge and 'brazilian/part-0001.json' in edge and 'record: 92' in edge),
    ("edge head contains exact Open Graph title and URL", 'og:title' in edge and 'og:url' in edge and 'canonical' in edge),
    ("edge head contains absolute PNG image and structured dimensions", 'og:image' in edge and 'og:image:type" content="image/png' in edge and 'og:image:width" content="640' in edge and 'og:image:height" content="480' in edge),
    ("edge head contains Twitter image fallback", 'twitter:image' in edge and 'summary_large_image' in edge),
    ("edge head contains VideoObject metadata", 'VideoObject' in edge and 'thumbnailUrl' in edge and 'interactionStatistic' in edge),
    ("same-origin preview image function exists", proxy_path.exists() and 'path: "/preview-image"' in proxy and 'ImageResponse' in proxy and 'png-play-overlay-v4' in proxy),
    ("preview image function restricts upstream hosts", 'ALLOWED_HOSTS' in proxy and 'ei.phncdn.com' in proxy and 'pix-fl.phncdn.com' in proxy),
    ("edge metadata uses versioned same-origin play-overlay URL", 'previewImageUrl' in edge and '/preview-image?url=' in edge and '&v=play4' in edge),
    ("edge resolves ID-only featured and related records", 'loadVideoByPublicIndexes' in edge and '/js/data.js' in edge and '/js/catalog/related.json' in edge),
    ("dynamic template has a non-empty full-image fallback", re.search(r'<meta property="og:image" content="https://', template) is not None),
    ("dynamic template has image dimensions and Twitter image", 'og:image:width' in template and 'og:image:height' in template and 'twitter:image' in template),
    ("dynamic fallback uses centered-play preview URL", '/preview-image?url=' in template and 'v=play4' in template and 'image/png' in template and 'content="640"' in template and 'content="480"' in template),
    ("preview image embeds a centered SVG platform play button", '\"svg\"' in proxy and '\"polygon\"' in proxy and 'points: \"0,0 36,20 0,40\"' in proxy and 'width: 112' in proxy and 'height: 112' in proxy and 'top: 0' in proxy and 'left: 0' in proxy and 'alignItems: \"center\"' in proxy and 'justifyContent: \"center\"' in proxy),
    ("cache-busted runtime bundle reference exists", (ROOT / "js/app.js").exists() and 'const shareData = { title: video.title, url: shareUrl }' in (ROOT / "js/app.js").read_text(encoding="utf-8") and 'app.js?v=nx-share-play2' in (ROOT / "index.html").read_text(encoding="utf-8")),
    ("static generator uses versioned play-overlay PNG metadata", '&v=play4' in generator and 'image/png' in generator and 'content="640"' in generator and 'content="480"' in generator and 'video thumbnail with play button' in generator),
    ("browser annotates chunk records with catalog locators", 'v.catalogFile = file' in app and 'v.catalogIndex = recordIndex' in app),
    ("share URL includes catalog locators", 'params.set("catalog", catalogFile)' in app and 'params.set("record", String(catalogIndex))' in app),
    ("share URL uses current preview cache version", 'params.set("nx_preview", "7")' in app),
    ("edge response carries current preview build marker", 'x-nexus-preview-version' in edge and 'share-play-overlay-7' in edge),
    ("copy and native share use identical exact shareUrl", 'navigator.clipboard.writeText(shareUrl)' in app and 'const shareData = { title: video.title, url: shareUrl }' in app and 'navigator.share(shareData)' in app),
    ("screenshot record has exact primary and fallback images", bool(record and record.get("thumb") and record.get("thumbFallback"))),
    ("screenshot record index is stable", bool(record) and part.get("videos", []).index(record) == 92),
]

failures = [name for name, ok in checks if not ok]
report = {"valid": not failures, "checks": len(checks), "failures": failures}
print(json.dumps(report, indent=2))
if failures:
    raise SystemExit(1)
