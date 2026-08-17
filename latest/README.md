# Latest video feeds

This folder stores dated, machine-readable latest-video imports. Each daily feed is kept under `latest/YYYY-MM-DD/` and is referenced by `latest/index.json`.

The current feed was captured from the public source page:

`https://www.pornhub.com/video/webmasterss`

The importer copies only publicly exposed metadata and official embed URLs. It does not download or redistribute source video files. To add a new daily feed, save the public page HTML, then run:

```bash
python3 tools/import_latest_source.py \
  --html /path/to/page.html \
  --source-url https://www.pornhub.com/video/webmasterss \
  --date YYYY-MM-DD \
  --output-root latest
```

The browser loads `latest/index.json` and each dated feed in addition to the 4.8-million-video catalog. Every imported entry is normalized to the canonical **Newest** category, deduplicated by embed key across all dates, ordered by date descending, and included in the home feed’s session-aware rotation. The existing **Latest** search terms remain backward-compatible aliases for **Newest**.

Before committing a new feed, run `node --check js/app.js` and the repository’s catalog/SEO validators. Keep only public, permitted metadata and embed references in this folder.
