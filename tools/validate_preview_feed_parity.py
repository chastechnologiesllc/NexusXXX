#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from bs4 import BeautifulSoup


def image_url(value: object) -> bool:
    url = str(value or '').strip()
    if re.fullmatch(r'https://nexusxxx\.site/preview-image(?:-v2)?\?url=.+', url, re.I):
        return True
    return bool(re.match(r'^https?://', url, re.I) and re.search(r'\.(?:jpe?g|png|webp|gif)(?:[/?#]|$)', url, re.I))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=Path('.'))
    args = parser.parse_args()
    errors: list[str] = []
    watch_dir = args.root / 'pages' / 'watch'
    pages = sorted(watch_dir.glob('*.html'))
    config = json.loads((args.root / 'seo/site-config.json').read_text(encoding='utf-8'))
    expected = int(config.get('indexablePagePolicy', {}).get('featuredWatchPages', 0))
    if len(pages) != expected:
        errors.append(f'watch page count {len(pages)} != {expected}')
    for path in pages:
        text = path.read_text(encoding='utf-8')
        soup = BeautifulSoup(text, 'html.parser')
        if not soup.select_one('#share-copy'):
            errors.append(f'{path.name}: share-copy missing')
        if not soup.select_one('#related-list') or not soup.select_one('#related-load-more'):
            errors.append(f'{path.name}: up-next controls missing')
        if not soup.select_one('script') or 'window.__NEXUS_STATIC_VIDEO' not in text:
            errors.append(f'{path.name}: static record boot missing')
        og_url = soup.select_one('meta[property="og:url"]')
        canonical = soup.select_one('link[rel="canonical"]')
        if not og_url or not canonical or og_url.get('content') != canonical.get('href'):
            errors.append(f'{path.name}: canonical and og:url differ')
        images = [tag.get('content', '') for tag in soup.select('meta[property="og:image"]')]
        if any(not image_url(value) for value in images):
            errors.append(f'{path.name}: non-image og:image present')

    for path in sorted((args.root / 'latest').glob('*/*.json')):
        payload = json.loads(path.read_text(encoding='utf-8'))
        for video in payload.get('videos', []):
            watch_url = str(video.get('watchUrl', ''))
            if not re.fullmatch(r'pages/watch/[a-z0-9-]+\.html', watch_url, re.I):
                errors.append(f'{path}: {video.get("id")}: invalid watchUrl')
                continue
            page = args.root / watch_url
            if not page.exists():
                errors.append(f'{path}: {video.get("id")}: watch page missing')
                continue
            text = page.read_text(encoding='utf-8')
            if str(video.get('title', '')) not in text:
                errors.append(f'{page.name}: exact title missing')
            for marker in ('Category:', 'Views:', 'Duration:', 'id="share-copy"', 'id="related-list"'):
                if marker not in text:
                    errors.append(f'{page.name}: {marker} missing')
            if image_url(video.get('thumb')) and 'property="og:image"' not in text:
                errors.append(f'{page.name}: primary og:image missing')
            if image_url(video.get('thumbFallback')) and text.count('property="og:image"') < 2:
                errors.append(f'{page.name}: secondary og:image missing')

    report = {'valid': not errors, 'watchPages': len(pages), 'expectedWatchPages': expected, 'errors': errors[:100], 'errorCount': len(errors)}
    print(json.dumps(report, indent=2, ensure_ascii=False))
    if errors:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
