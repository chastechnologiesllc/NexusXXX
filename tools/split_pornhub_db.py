#!/usr/bin/env python3
"""Split the supplied Pornhub pipe-delimited export into categorized chunks.

The source archive is intentionally streamed from the ZIP so the 18+ GB
uncompressed CSV is never loaded into memory. Each source row is written once
into a deterministic primary-category directory; the original semicolon-
delimited category field is retained in every output row.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import shutil
import unicodedata
import zipfile
from collections import OrderedDict
from dataclasses import dataclass, field
from pathlib import Path

PART_TARGET_BYTES = 75_000_000
EXPECTED_FIELDS = 13
SOURCE_MEMBER = "pornhub.com-db.csv"

# The export has no header. These names are deliberately conservative for the
# two numeric columns whose semantics are not declared by the source file.
HEADER = (
    "embed_html",
    "thumbnail",
    "thumbnail_sequence",
    "title",
    "tags",
    "categories",
    "performer",
    "duration_seconds",
    "views",
    "source_metric_1",
    "source_metric_2",
    "thumbnail_large",
    "thumbnail_sequence_large",
)


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value or "uncategorized"


def safe_category_slug(label: str, owners: dict[str, str]) -> str:
    base = slugify(label)
    owner = owners.get(base)
    if owner is None or owner == label:
        owners[base] = label
        return base
    suffix = hashlib.sha1(label.encode("utf-8")).hexdigest()[:8]
    slug = f"{base}-{suffix}"
    owners[slug] = label
    return slug


def strip_line_ending(raw: bytes) -> bytes:
    if raw.endswith(b"\n"):
        raw = raw[:-1]
    if raw.endswith(b"\r"):
        raw = raw[:-1]
    return raw


@dataclass
class PartState:
    category_label: str
    category_slug: str
    part_number: int = 0
    path: Path | None = None
    handle: object | None = None
    bytes_written: int = 0
    rows: int = 0
    digest: hashlib._Hash = field(default_factory=hashlib.sha256)
    part_paths: list[Path] = field(default_factory=list)
    part_rows: list[int] = field(default_factory=list)
    part_bytes: list[int] = field(default_factory=list)
    part_sha256: list[str] = field(default_factory=list)

    def close(self) -> None:
        if self.handle is not None:
            self.handle.flush()
            self.handle.close()
            self.handle = None

    def open_next(self, root: Path) -> None:
        self.close()
        self.part_number += 1
        category_dir = root / "categories" / self.category_slug
        category_dir.mkdir(parents=True, exist_ok=True)
        self.path = category_dir / f"part-{self.part_number:04d}.csv"
        self.handle = self.path.open("wb")
        header = ("|".join(HEADER) + "\n").encode("utf-8")
        self.handle.write(header)
        self.bytes_written = len(header)
        self.rows = 0
        self.digest = hashlib.sha256()
        self.part_paths.append(self.path)

    def write(self, raw: bytes, root: Path) -> None:
        if self.handle is None:
            self.open_next(root)
        if self.rows and self.bytes_written + len(raw) > PART_TARGET_BYTES:
            self.close()
            self.part_bytes[-1] = self.bytes_written
            self.part_rows[-1] = self.rows
            self.part_sha256[-1] = self.digest.hexdigest()
            self.open_next(root)
        self.handle.write(raw)
        self.bytes_written += len(raw)
        self.rows += 1
        self.digest.update(raw)
        if len(self.part_bytes) < len(self.part_paths):
            self.part_bytes.append(0)
            self.part_rows.append(0)
            self.part_sha256.append("")

    def finalize(self) -> None:
        if self.handle is not None:
            self.close()
            self.part_bytes[-1] = self.bytes_written
            self.part_rows[-1] = self.rows
            self.part_sha256[-1] = self.digest.hexdigest()


def write_csv(path: Path, rows: list[dict[str, object]], fieldnames: list[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def split_archive(archive: Path, output: Path) -> dict[str, object]:
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)

    category_states: OrderedDict[str, PartState] = OrderedDict()
    category_owners: dict[str, str] = {}
    source_digest = hashlib.sha256()
    source_rows = 0
    source_bytes = 0
    malformed_rows = 0
    oversized_rows = 0
    category_label_counts: dict[str, int] = {}

    with zipfile.ZipFile(archive) as zf:
        info = zf.getinfo(SOURCE_MEMBER)
        with zf.open(info, "r") as source:
            for raw in source:
                source_rows += 1
                source_bytes += len(raw)
                source_digest.update(raw)
                body = strip_line_ending(raw)
                fields = body.split(b"|")
                if len(fields) != EXPECTED_FIELDS:
                    malformed_rows += 1
                categories_field = fields[5].decode("utf-8", "replace") if len(fields) > 5 else ""
                labels = [label.strip() for label in categories_field.split(";") if label.strip()]
                primary_label = labels[0] if labels else "Uncategorized"
                category_label_counts[primary_label] = category_label_counts.get(primary_label, 0) + 1
                category_slug = safe_category_slug(primary_label, category_owners)
                state = category_states.get(category_slug)
                if state is None:
                    state = PartState(primary_label, category_slug)
                    category_states[category_slug] = state
                if len(raw) + len(("|".join(HEADER) + "\n").encode("utf-8")) > PART_TARGET_BYTES:
                    oversized_rows += 1
                state.write(raw, output)

    for state in category_states.values():
        state.finalize()

    manifest_rows: list[dict[str, object]] = []
    file_rows: list[dict[str, object]] = []
    for state in category_states.values():
        for index, path in enumerate(state.part_paths):
            relative = path.relative_to(output).as_posix()
            file_rows.append(
                {
                    "category": state.category_label,
                    "category_slug": state.category_slug,
                    "part": index + 1,
                    "rows": state.part_rows[index],
                    "bytes": state.part_bytes[index],
                    "sha256": state.part_sha256[index],
                    "path": relative,
                }
            )
        manifest_rows.append(
            {
                "category": state.category_label,
                "category_slug": state.category_slug,
                "rows": sum(state.part_rows),
                "parts": len(state.part_paths),
                "bytes": sum(state.part_bytes),
            }
        )

    write_csv(output / "manifest.csv", file_rows, ["category", "category_slug", "part", "rows", "bytes", "sha256", "path"])
    write_csv(output / "category-summary.csv", manifest_rows, ["category", "category_slug", "rows", "parts", "bytes"])

    metadata = {
        "source_archive_name": archive.name,
        "source_member": SOURCE_MEMBER,
        "source_member_compressed_bytes": info.compress_size,
        "source_member_uncompressed_bytes": info.file_size,
        "source_member_crc32": f"{info.CRC:08x}",
        "source_member_sha256": source_digest.hexdigest(),
        "source_rows": source_rows,
        "source_bytes_seen": source_bytes,
        "malformed_rows": malformed_rows,
        "oversized_rows": oversized_rows,
        "output_rows": sum(row["rows"] for row in manifest_rows),
        "output_bytes": sum(row["bytes"] for row in manifest_rows),
        "category_count": len(manifest_rows),
        "part_count": len(file_rows),
        "part_target_bytes": PART_TARGET_BYTES,
        "primary_category_rule": "Route each row to the first non-empty label in its original semicolon-delimited categories field; retain the complete categories field in the row.",
        "field_count": EXPECTED_FIELDS,
        "fields": list(HEADER),
        "primary_category_counts": dict(sorted(category_label_counts.items(), key=lambda item: (-item[1], item[0].lower()))),
    }
    (output / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    return metadata


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    metadata = split_archive(args.archive, args.output)
    print(json.dumps({key: metadata[key] for key in ("source_rows", "malformed_rows", "output_rows", "category_count", "part_count", "output_bytes", "source_member_sha256")}, indent=2))


if __name__ == "__main__":
    main()
