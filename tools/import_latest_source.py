#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

from bs4 import BeautifulSoup


def first_image(card):
    image = card.find('img')
    if not image:
        return ''
    return image.get('data-src') or image.get('src') or image.get('data-original') or ''


def parse_views(text: str, duration_end: int) -> int:
    tail = text[duration_end:]
    before_age = re.split(r'\b\d+\s+(?:second|minute|hour|day|week|month|year)s?\s+ago\b', tail, maxsplit=1, flags=re.I)[0]
    candidates = re.findall(r'\b\d[\d,.]*\s*[KMB]?\b', before_age, flags=re.I)
    for token in candidates:
        token = token.replace(',', '').replace(' ', '')
        if token.endswith(('K', 'M', 'B')):
            number = float(token[:-1])
            multiplier = {'K': 1_000, 'M': 1_000_000, 'B': 1_000_000_000}[token[-1].upper()]
            return int(number * multiplier)
    return 0


def parse_page(html: str, source_url: str, captured_at: str):
    soup = BeautifulSoup(html, 'html.parser')
    records = []
    seen = set()
    for anchor in soup.select('a[href*="view_video.php?viewkey="]'):
        match = re.search(r'viewkey=([^&"#]+)', anchor.get('href', ''))
        if not match:
            continue
        viewkey = match.group(1)
        if viewkey in seen:
            continue
        card = anchor.find_parent('li', class_=lambda value: value and 'videoblock' in value)
        if card is None:
            card = anchor.parent
        title = (anchor.get('title') or anchor.get_text(' ', strip=True)).strip()
        text = card.get_text(' ', strip=True)
        duration_match = re.search(r'\b(\d{1,2}:\d{2}(?::\d{2})?)\b', text)
        duration = duration_match.group(1) if duration_match else '0:00'
        views = parse_views(text, duration_match.end() if duration_match else 0)
        records.append({
            'id': viewkey,
            'title': title,
            'thumb': urljoin(source_url, first_image(card)),
            'embedSrc': f'https://www.pornhub.com/embed/{viewkey}',
            'duration': duration,
            'views': views,
            'added': captured_at[:10],
            'category': 'Newest',
            'tags': ['latest', 'newest', 'webmasterss'],
            'source': source_url,
            'sourceViewKey': viewkey,
        })
        seen.add(viewkey)
    return records


def load_existing_feeds(root: Path):
    feeds = {}
    for path in sorted(root.glob('*/*.json')):
        if path.name == 'index.json':
            continue
        try:
            payload = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, json.JSONDecodeError):
            continue
        if isinstance(payload.get('videos'), list) and payload.get('date'):
            feeds[str(payload['date'])] = (path, payload)
    return feeds


def rebuild_manifest(root: Path, new_payload: dict):
    feeds = load_existing_feeds(root)
    feeds[str(new_payload['date'])] = (root / str(new_payload['date']) / 'webmasterss.json', new_payload)
    seen: set[str] = set()
    entries = []
    total = 0
    for day in sorted(feeds.keys(), reverse=True):
        path, payload = feeds[day]
        unique_videos = []
        for video in payload.get('videos', []):
            video = dict(video)
            video['category'] = 'Newest'
            video['added'] = str(video.get('added') or day)[:10]
            video['tags'] = sorted(set((video.get('tags') or []) + ['newest']))
            video_id = str(video.get('id', ''))
            if not video_id or video_id in seen:
                continue
            seen.add(video_id)
            unique_videos.append(video)
        payload['category'] = 'Newest'
        payload['videos'] = unique_videos
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
        total += len(unique_videos)
        entries.append({
            'date': day,
            'source': payload.get('source', ''),
            'file': f'{day}/{path.name}',
            'count': len(unique_videos),
            'capturedAt': payload.get('capturedAt', ''),
        })
    index = {
        'version': '2.0',
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'category': 'Newest',
        'latest': entries,
        'totalVideos': total,
        'uniqueBy': 'id',
        'sort': 'date descending, then source order',
    }
    (root / 'index.json').write_text(json.dumps(index, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return index


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--html', type=Path, required=True)
    parser.add_argument('--source-url', required=True)
    parser.add_argument('--date', default=date.today().isoformat())
    parser.add_argument('--output-root', type=Path, default=Path('latest'))
    args = parser.parse_args()

    captured_at = datetime.now(timezone.utc).isoformat()
    records = parse_page(args.html.read_text(encoding='utf-8', errors='ignore'), args.source_url, captured_at)
    if not records:
        raise SystemExit('No public video embeds were found; refusing to overwrite latest data.')
    payload = {
        'version': '2.0',
        'date': args.date,
        'capturedAt': captured_at,
        'source': args.source_url,
        'category': 'Newest',
        'videos': records,
    }
    index = rebuild_manifest(args.output_root, payload)
    print(json.dumps({'date': args.date, 'imported': len(records), 'uniqueTotal': index['totalVideos'], 'feedFiles': len(index['latest'])}, indent=2))


if __name__ == '__main__':
    main()
