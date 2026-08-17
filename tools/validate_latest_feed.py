#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

REQUIRED = ('id', 'title', 'thumb', 'embedSrc', 'duration', 'views', 'added', 'category', 'tags')


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=Path('latest'))
    parser.add_argument('--report', type=Path, default=Path('audit/latest-validation.json'))
    args = parser.parse_args()
    index = json.loads((args.root / 'index.json').read_text(encoding='utf-8'))
    errors: list[str] = []
    seen: set[str] = set()
    count = 0
    for entry in index.get('latest', []):
        path = args.root / entry['file']
        if not path.exists():
            errors.append(f'missing feed: {entry["file"]}')
            continue
        feed = json.loads(path.read_text(encoding='utf-8'))
        videos = feed.get('videos', [])
        if len(videos) != int(entry.get('count', -1)):
            errors.append(f'count mismatch: {entry["file"]}')
        for video in videos:
            count += 1
            video_id = str(video.get('id', ''))
            if not video_id:
                errors.append(f'missing id: {entry["file"]}')
            if video_id in seen:
                errors.append(f'duplicate id: {video_id}')
            seen.add(video_id)
            if not str(video.get('embedSrc', '')).startswith('https://www.pornhub.com/embed/'):
                errors.append(f'non-official embed: {video_id}')
            for field in REQUIRED:
                if field not in video:
                    errors.append(f'{video_id}: missing {field}')
    if count != int(index.get('totalVideos', -1)):
        errors.append('index totalVideos mismatch')
    report = {'valid': not errors, 'errors': errors, 'feed_files': len(index.get('latest', [])), 'videos': count, 'unique_ids': len(seen)}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if not errors else 1)


if __name__ == '__main__':
    main()
