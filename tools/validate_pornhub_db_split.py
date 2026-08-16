#!/usr/bin/env python3
"""Validate a categorized split produced by split_pornhub_db.py."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path

EXPECTED_HEADER = (
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
MAX_FILE_BYTES = 75_000_000


def sha256_data_rows(path: Path) -> str:
    """Hash the data rows only; the splitter records this digest per chunk."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        handle.readline()
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def validate(root: Path) -> dict[str, object]:
    metadata = json.loads((root / "metadata.json").read_text(encoding="utf-8"))
    with (root / "manifest.csv").open("r", encoding="utf-8", newline="") as handle:
        manifest = list(csv.DictReader(handle))
    with (root / "category-summary.csv").open("r", encoding="utf-8", newline="") as handle:
        category_summary = list(csv.DictReader(handle))

    errors: list[str] = []
    seen_paths: set[str] = set()
    observed_rows = 0
    observed_bytes = 0
    observed_categories: dict[str, int] = {}

    for row in manifest:
        rel = row["path"]
        if rel in seen_paths:
            errors.append(f"duplicate manifest path: {rel}")
        seen_paths.add(rel)
        path = root / rel
        if not path.is_file():
            errors.append(f"missing chunk: {rel}")
            continue
        actual_size = path.stat().st_size
        expected_size = int(row["bytes"])
        if actual_size != expected_size:
            errors.append(f"size mismatch: {rel}: {actual_size} != {expected_size}")
        if actual_size > MAX_FILE_BYTES:
            errors.append(f"chunk exceeds limit: {rel}: {actual_size}")
        actual_digest = sha256_data_rows(path)
        if actual_digest != row["sha256"]:
            errors.append(f"checksum mismatch: {rel}")

        rows = 0
        with path.open("rb") as handle:
            header = handle.readline().rstrip(b"\r\n").decode("utf-8")
            if header.split("|") != list(EXPECTED_HEADER):
                errors.append(f"header mismatch: {rel}")
            for raw in handle:
                rows += 1
                if len(raw.rstrip(b"\r\n").split(b"|")) != len(EXPECTED_HEADER):
                    errors.append(f"field-count mismatch: {rel} at data row {rows}")
                    break
        expected_rows = int(row["rows"])
        if rows != expected_rows:
            errors.append(f"row mismatch: {rel}: {rows} != {expected_rows}")
        observed_rows += rows
        observed_bytes += actual_size
        category = row["category"]
        observed_categories[category] = observed_categories.get(category, 0) + rows

    summary_rows = {row["category"]: int(row["rows"]) for row in category_summary}
    if summary_rows != observed_categories:
        errors.append("category-summary.csv does not match observed chunk rows")
    if observed_rows != int(metadata["source_rows"]):
        errors.append(f"total rows mismatch: {observed_rows} != {metadata['source_rows']}")
    if observed_rows != int(metadata["output_rows"]):
        errors.append(f"metadata output row mismatch: {observed_rows} != {metadata['output_rows']}")
    if observed_bytes != int(metadata["output_bytes"]):
        errors.append(f"metadata output byte mismatch: {observed_bytes} != {metadata['output_bytes']}")
    if len(manifest) != int(metadata["part_count"]):
        errors.append(f"part count mismatch: {len(manifest)} != {metadata['part_count']}")
    if len(summary_rows) != int(metadata["category_count"]):
        errors.append(f"category count mismatch: {len(summary_rows)} != {metadata['category_count']}")

    report = {
        "valid": not errors,
        "errors": errors,
        "source_rows": int(metadata["source_rows"]),
        "validated_rows": observed_rows,
        "source_bytes": int(metadata["source_bytes_seen"]),
        "validated_output_bytes": observed_bytes,
        "categories": len(summary_rows),
        "chunks": len(manifest),
        "max_chunk_bytes": max((int(row["bytes"]) for row in manifest), default=0),
    }
    (root / "validation.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path)
    args = parser.parse_args()
    report = validate(args.root)
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if report["valid"] else 1)


if __name__ == "__main__":
    main()
