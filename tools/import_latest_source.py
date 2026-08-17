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
        record = {
            'id': viewkey,
            'title': title,
            'thumb': urljoin(source_url, first_image(card)),
            'embedSrc': f'https://www.pornhub.com/embed/{viewkey}',
            'duration': duration,
            'views': views,
            'added': captured_at[:10],
            'category': 'Latest',
            'tags': ['latest', 'webmasterss'],
            'source': source_url,
            'sourceViewKey': viewkey,
        }
        seen.add(viewkey)
        records.append(record)
    return records


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

    day_dir = args.output_root / args.date
    day_dir.mkdir(parents=True, exist_ok=True)
    feed_path = day_dir / 'webmasterss.json'
    payload = {
        'version': '1.0',
        'date': args.date,
        'capturedAt': captured_at,
        'source': args.source_url,
        'category': 'Latest',
        'videos': records,
    }
    feed_path.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')

    index_path = args.output_root / 'index.json'
    index = {
        'version': '1.0',
        'generatedAt': captured_at,
        'latest': [
            {
                'date': args.date,
                'source': args.source_url,
                'file': f'{args.date}/webmasterss.json',
                'count': len(records),
            }
        ],
        'totalVideos': len(records),
    }
    index_path.write_text(json.dumps(index, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'file': str(feed_path), 'index': str(index_path), 'count': len(records)}, indent=2))


if __name__ == '__main__':
    main()
