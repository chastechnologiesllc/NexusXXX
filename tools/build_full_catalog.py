#!/usr/bin/env python3
"""Build the complete NexusXXX catalog from the tracked CSV corpus.

The builder is intentionally streaming at the CSV boundary and uses SQLite for
stable global deduplication. It produces a browser-friendly split catalog with
multiple JSON chunks per category, a generated index, and a featured data.js.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sqlite3
import sys
import unicodedata
from collections import Counter
from datetime import date
from pathlib import Path

EXPECTED_FIELDS = 13
CHUNK_RECORDS = 25_000
EMBED_RE = re.compile(rb"/embed/([A-Za-z0-9]+)")
VALID_THUMB_PREFIXES = ("https://ei.phncdn.com/", "https://di.phncdn.com/")

# Keep names already used by the website stable while merging equivalent source
# folders into one canonical category.
SLUG_ALIASES = {
    "18-25": "teen",
    "college-18": "college",
    "red-head": "redhead",
}
DISPLAY_OVERRIDES = {
    "bbw": "BBW",
    "pov": "POV",
    "sfw": "SFW",
    "hd-porn": "HD Porn",
    "18-25": "Teen",
    "college": "College",
    "redhead": "Redhead",
    "teen": "Teen",
    "twink-18": "Twink 18",
    "rough-sex": "Rough Sex",
    "gay": "Gay",
    "old-young-18": "Old Young 18",
    "muscular-men": "Muscular Men",
    "behind-the-scenes": "Behind the Scenes",
    "trans-with-guy": "Trans With Guy",
    "verified-amateurs": "Verified Amateurs",
    "verified-models": "Verified Models",
    "verified-couples": "Verified Couples",
    "double-penetration": "Double Penetration",
    "role-play": "Role Play",
    "solo-female": "Solo Female",
    "solo-male": "Solo Male",
    "small-tits": "Small Tits",
    "big-ass": "Big Ass",
    "big-dick": "Big Dick",
    "big-tits": "Big Tits",
    "big-ass": "Big Ass",
    "big-dick": "Big Dick",
    "big-tits": "Big Tits",
}


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value or "uncategorized"


def canonical_slug(source_slug: str) -> str:
    return SLUG_ALIASES.get(source_slug, source_slug)


def watch_slug(video: dict[str, object]) -> str:
    video_id = re.sub(r"[^a-zA-Z0-9]+", "", str(video.get("id", "video"))).lower()
    return f"{slugify(str(video.get('title', 'video')))[:90]}-{video_id}".strip("-")


def display_name(slug: str, source_label: str) -> str:
    if slug in DISPLAY_OVERRIDES:
        return DISPLAY_OVERRIDES[slug]
    words = source_label.replace("-", " ").split()
    return " ".join(word.upper() if len(word) <= 3 else word.capitalize() for word in words) or slug


def duration_text(seconds: str) -> str:
    try:
        total = max(0, int(float(seconds or 0)))
    except ValueError:
        return "0:00"
    minutes, secs = divmod(total, 60)
    hours, minutes = divmod(minutes, 60)
    if hours:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"


def safe_int(value: bytes) -> int:
    try:
        return max(0, int(value.decode("ascii", "ignore") or 0))
    except ValueError:
        return 0


def decode(value: bytes) -> str:
    return value.decode("utf-8", "replace").strip()


def make_tags(raw_tags: str, raw_categories: str, category_name: str) -> list[str]:
    tags: list[str] = []
    seen: set[str] = set()
    for value in (raw_tags.split(";"), raw_categories.split(";"), [category_name]):
        for item in value:
            tag = item.strip()
            key = tag.lower()
            if tag and key not in seen:
                seen.add(key)
                tags.append(tag)
    return tags


def make_record(fields: list[bytes], category_slug: str, category_name: str) -> dict[str, object] | None:
    if len(fields) != EXPECTED_FIELDS:
        return None
    match = EMBED_RE.search(fields[0])
    if not match:
        return None
    video_id = match.group(1).decode("ascii")
    title = decode(fields[3])
    thumb_small = decode(fields[1])
    thumb_large = decode(fields[11])
    thumb = thumb_large if thumb_large.startswith(VALID_THUMB_PREFIXES) else thumb_small
    thumb_fallback = thumb_small if thumb_small.startswith(VALID_THUMB_PREFIXES) and thumb_small != thumb else ""
    if not title or not thumb.startswith(VALID_THUMB_PREFIXES):
        return None
    tags = make_tags(decode(fields[4]), decode(fields[5]), category_name)
    return {
        "id": video_id,
        "title": title,
        "slug": slugify(title)[:120],
        "thumb": thumb,
        "thumbFallback": thumb_fallback,
        "duration": duration_text(decode(fields[7])),
        "views": safe_int(fields[8]),
        "category": category_name,
        "tags": tags,
        "embedSrc": f"https://www.pornhub.com/embed/{video_id}",
        "source": "Pornhub",
        "added": date.today().isoformat(),
        "pageUrl": f"https://www.pornhub.com/view_video.php?viewkey={video_id}",
    }


def configure_db(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        PRAGMA journal_mode=OFF;
        PRAGMA synchronous=OFF;
        PRAGMA temp_store=MEMORY;
        PRAGMA cache_size=-200000;
        CREATE TABLE videos (
            id TEXT PRIMARY KEY,
            category_slug TEXT NOT NULL,
            category_name TEXT NOT NULL,
            title TEXT NOT NULL,
            slug TEXT NOT NULL,
            thumb TEXT NOT NULL,
            thumbFallback TEXT NOT NULL,
            duration TEXT NOT NULL,
            views INTEGER NOT NULL,
            tags_json TEXT NOT NULL,
            embedSrc TEXT NOT NULL,
            source TEXT NOT NULL,
            added TEXT NOT NULL,
            pageUrl TEXT NOT NULL
        );
        CREATE INDEX videos_category_views ON videos(category_slug, views DESC, id);
        CREATE INDEX videos_views ON videos(views DESC, id);
        """
    )


def ingest_csvs(csv_root: Path, db_path: Path) -> dict[str, object]:
    csv_paths = sorted(csv_root.glob("*/part-*.csv"))
    if not csv_paths:
        raise SystemExit(f"No CSV parts found under {csv_root}")
    conn = sqlite3.connect(db_path)
    configure_db(conn)
    insert_sql = """
        INSERT INTO videos VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET
            category_slug=excluded.category_slug,
            category_name=excluded.category_name,
            title=excluded.title,
            slug=excluded.slug,
            thumb=excluded.thumb,
            thumbFallback=excluded.thumbFallback,
            duration=excluded.duration,
            views=excluded.views,
            tags_json=excluded.tags_json,
            embedSrc=excluded.embedSrc,
            source=excluded.source,
            added=excluded.added,
            pageUrl=excluded.pageUrl
        WHERE excluded.views > videos.views
    """
    source_rows = valid_rows = invalid_fields = invalid_records = 0
    category_rows: Counter[str] = Counter()
    batch: list[tuple[object, ...]] = []
    for index, path in enumerate(csv_paths, 1):
        source_slug = canonical_slug(path.parent.name)
        category_name = display_name(source_slug, path.parent.name)
        with path.open("rb") as handle:
            first = handle.readline()
            if not first.startswith(b"embed_html|"):
                handle.seek(0)
            for raw in handle:
                source_rows += 1
                fields = raw.rstrip(b"\r\n").split(b"|")
                if len(fields) != EXPECTED_FIELDS:
                    invalid_fields += 1
                    continue
                record = make_record(fields, source_slug, category_name)
                if record is None:
                    invalid_records += 1
                    continue
                valid_rows += 1
                category_rows[source_slug] += 1
                batch.append(
                    (
                        record["id"], source_slug, category_name, record["title"], record["slug"],
                        record["thumb"], record["thumbFallback"], record["duration"], record["views"], json.dumps(record["tags"], ensure_ascii=False),
                        record["embedSrc"], record["source"], record["added"], record["pageUrl"],
                    )
                )
                if len(batch) >= 5000:
                    conn.executemany(insert_sql, batch)
                    conn.commit()
                    batch.clear()
        if index % 10 == 0 or index == len(csv_paths):
            print(f"ingested {index}/{len(csv_paths)} CSV parts; source_rows={source_rows}; valid={valid_rows}", file=sys.stderr, flush=True)
    if batch:
        conn.executemany(insert_sql, batch)
        conn.commit()
    unique_rows = conn.execute("SELECT COUNT(*) FROM videos").fetchone()[0]
    conn.close()
    return {
        "csv_parts": len(csv_paths),
        "source_rows": source_rows,
        "valid_rows": valid_rows,
        "invalid_field_rows": invalid_fields,
        "invalid_record_rows": invalid_records,
        "unique_videos": unique_rows,
        "category_source_rows": dict(sorted(category_rows.items())),
    }


def row_to_record(row: tuple[object, ...]) -> dict[str, object]:
    (
        video_id, _category_slug, category_name, title, slug, thumb, thumb_fallback, duration,
        views, tags_json, embed_src, source, added, page_url,
    ) = row
    return {
        "id": video_id,
        "title": title,
        "slug": slug,
        "thumb": thumb,
        "thumbFallback": thumb_fallback,
        "duration": duration,
        "views": views,
        "category": category_name,
        "tags": json.loads(tags_json),
        "embedSrc": embed_src,
        "source": source,
        "added": added,
        "pageUrl": page_url,
    }


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def build_outputs(db_path: Path, output_root: Path, ingest: dict[str, object]) -> dict[str, object]:
    if output_root.exists():
        shutil.rmtree(output_root)
    catalog_root = output_root / "js" / "catalog"
    catalog_root.mkdir(parents=True)
    conn = sqlite3.connect(db_path)
    categories = []
    category_map: dict[str, str] = {}
    category_names: dict[str, str] = {}
    category_counts = conn.execute(
        "SELECT category_slug, category_name, COUNT(*) FROM videos GROUP BY category_slug, category_name ORDER BY COUNT(*) DESC, category_slug"
    ).fetchall()
    for category_slug, category_name, count in category_counts:
        category_map[category_name] = category_slug
        category_names[category_slug] = category_name
        files: list[str] = []
        total = int(count)
        for part_index, offset in enumerate(range(0, total, CHUNK_RECORDS), 1):
            rows = conn.execute(
                "SELECT id,category_slug,category_name,title,slug,thumb,thumbFallback,duration,views,tags_json,embedSrc,source,added,pageUrl "
                "FROM videos WHERE category_slug=? ORDER BY views DESC, id LIMIT ? OFFSET ?",
                (category_slug, CHUNK_RECORDS, offset),
            ).fetchall()
            relative = Path(category_slug) / f"part-{part_index:04d}.json"
            records = [row_to_record(row) for row in rows]
            for record_index, record in enumerate(records):
                record["catalogFile"] = relative.as_posix()
                record["catalogIndex"] = record_index
            write_json(
                catalog_root / relative,
                {
                    "category": category_name,
                    "slug": category_slug,
                    "part": part_index,
                    "offset": offset,
                    "total": total,
                    "videos": records,
                },
            )
            files.append(relative.as_posix())
        categories.append({
            "name": category_name,
            "slug": category_slug,
            "count": total,
            "parts": len(files),
            "files": files,
        })
        print(f"built {category_name}: {total} videos in {len(files)} chunks", file=sys.stderr, flush=True)

    featured_rows = conn.execute(
        "SELECT id,category_slug,category_name,title,slug,thumb,thumbFallback,duration,views,tags_json,embedSrc,source,added,pageUrl "
        "FROM videos ORDER BY views DESC, id LIMIT 1500"
    ).fetchall()
    featured = [row_to_record(row) for row in featured_rows]
    for record in featured:
        record["watchUrl"] = "pages/watch/" + watch_slug(record) + ".html"
    data_js = (
        "/* NexusXXX full-catalog featured set; generated by tools/build_full_catalog.py */\n"
        f"const VIDEOS = {json.dumps(featured, ensure_ascii=False, separators=(',', ':'))};\n"
        f"const CATEGORIES = {json.dumps([row['name'] for row in categories], ensure_ascii=False)};\n"
        f"const CATALOG_INDEX = {json.dumps(category_map, ensure_ascii=False, separators=(',', ':'))};\n"
    )
    (output_root / "js" / "data.js").write_text(data_js, encoding="utf-8")

    total_videos = int(conn.execute("SELECT COUNT(*) FROM videos").fetchone()[0])
    index = {
        "version": "3.0",
        "generated": date.today().isoformat(),
        "total_videos": total_videos,
        "featured_count": len(featured),
        "category_count": len(categories),
        "chunk_records": CHUNK_RECORDS,
        "deduplicated_by": "embed ID, keeping the highest-view record",
        "source": "tracked data/pornhub-db-split/categories/**/*.csv",
        "source_csv_parts": ingest["csv_parts"],
        "source_rows": ingest["source_rows"],
        "valid_rows": ingest["valid_rows"],
        "invalid_field_rows": ingest["invalid_field_rows"],
        "invalid_record_rows": ingest["invalid_record_rows"],
        "categories": categories,
    }
    write_json(catalog_root / "index.json", index)
    write_json(output_root / "catalog-build-summary.json", {"ingest": ingest, "index": index})
    conn.close()
    return index


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--db", type=Path, required=True)
    args = parser.parse_args()
    if args.db.exists():
        args.db.unlink()
    ingest = ingest_csvs(args.csv_root, args.db)
    index = build_outputs(args.db, args.output, ingest)
    summary = {
        "source_rows": ingest["source_rows"],
        "valid_rows": ingest["valid_rows"],
        "unique_videos": index["total_videos"],
        "categories": index["category_count"],
        "featured": index["featured_count"],
        "csv_parts": ingest["csv_parts"],
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
