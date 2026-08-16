# Categorized Pornhub Database Export

This directory contains the complete `pornhub.com-db.csv` export split into GitHub-compatible CSV chunks. The source archive contained **4,797,027 records** and every record is represented exactly once in the categorized output.

## Layout

```text
pornhub-db-split/
├── categories/
│   ├── amateur/
│   │   ├── part-0001.csv
│   │   └── ...
│   ├── asian/
│   └── ...
├── category-summary.csv
├── manifest.csv
├── metadata.json
├── validation.json
└── README.md
```

The `categories/` directory contains **119 primary-category directories** and **341 CSV chunks**. Each chunk is capped below 75,000,000 bytes. The original category field remains intact in each row, so secondary category labels and all source metadata are preserved.

## Category assignment

The source export has no header row and uses a pipe (`|`) delimiter. A row is assigned to the first non-empty label in its semicolon-delimited `categories` field. Rows without a category are assigned to `uncategorized`. Category labels are converted to stable lowercase slugs for directory names; the original label is retained in the manifest and in the row data.

> The split is a storage organization only. It does not remove, rewrite, or deduplicate source records.

## CSV fields

Each generated chunk has the following header:

| Position | Field | Description |
|---:|---|---|
| 1 | `embed_html` | Official embed HTML from the source export |
| 2 | `thumbnail` | Primary thumbnail URL |
| 3 | `thumbnail_sequence` | Semicolon-delimited thumbnail sequence |
| 4 | `title` | Source title |
| 5 | `tags` | Semicolon-delimited tags |
| 6 | `categories` | Semicolon-delimited source categories |
| 7 | `performer` | Performer or channel label |
| 8 | `duration_seconds` | Source duration value |
| 9 | `views` | Source view count |
| 10 | `source_metric_1` | Source numeric field retained without reinterpretation |
| 11 | `source_metric_2` | Source numeric field retained without reinterpretation |
| 12 | `thumbnail_large` | Large thumbnail URL |
| 13 | `thumbnail_sequence_large` | Semicolon-delimited large-thumbnail sequence |

## Manifests and validation

`manifest.csv` lists every chunk with its primary category, row count, byte count, relative path, and SHA-256 digest of its data rows. `category-summary.csv` aggregates the chunks by primary category. `metadata.json` records the source archive/member metadata, source digest, row totals, category totals, and output totals. `validation.json` records the final integrity check.

The final validation confirms that all **4,797,027 source rows** are present in the output, all rows retain 13 pipe-delimited fields, all chunk checksums match the manifest, all 341 chunks remain below the configured size limit, and the output contains 119 categories.

## Reproducibility

The splitter and validator are stored in `tools/`:

```bash
python3 tools/split_pornhub_db.py /path/to/pornhub.com-db.zip data/pornhub-db-split
python3 tools/validate_pornhub_db_split.py data/pornhub-db-split
```

The splitter streams the ZIP member and does not load the full 18+ GB uncompressed CSV into memory.
