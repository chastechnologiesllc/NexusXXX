# NexusXXX SEO and indexing maintenance note

Every new video added to the catalog must be treated as an indexable content record, not only as a feed item. Before deployment, the record must have a stable unique ID, a descriptive title, a clean slug, a valid primary thumbnail, a fallback thumbnail when available, duration, view count, category, source-backed tags, embed URL, and the exact `catalogFile` plus zero-based `catalogIndex` locator.

The canonical public URL for each video is:

```text
https://nexusxxx.site/watch/{title-slug}-{video-id}.html
```

The `/watch/*` route is rewritten to `pages/video.html` and enriched by the Edge metadata function. It must return a `200` page with a unique title, unique meta description, `index, follow`, self-referential canonical URL, Open Graph/Twitter metadata, visible title/category/duration/views/tag copy, breadcrumbs, and valid `VideoObject` JSON-LD. The page must contain an actual crawlable player URL or embed URL when available. Do not use the generic dynamic shell as the canonical URL for an individual video.

After adding or rebuilding catalog data, run the following workflow from the repository root:

```bash
python3 -B tools/build_full_catalog.py --csv-root data/pornhub-db-split/categories --output /tmp/nexusxxx-catalog-build
# Review the generated output before copying it into the repository.
python3 -B tools/build_video_locator_index.py --catalog js/catalog --output js/catalog/locator-index
python3 -B tools/build_seo_assets.py --catalog js/catalog --output-root . --site-url https://nexusxxx.site --source-csv-root data/pornhub-db-split/categories --tag-min 50000 --performer-min 50
python3 -B tools/generate_category_hub.py
python3 -B tools/generate_home_seo_links.py --page index.html --data js/data.js --site-url https://nexusxxx.site
python3 -B tools/generate_watch_pages.py
python3 -B tools/generate_sitemap.py --config seo/site-config.json --catalog js/catalog/index.json --root . --output sitemap.xml --sitemap-dir sitemaps --chunk-size 50000
```

The sitemap workflow must produce one sitemap index, one page sitemap, and video sitemap shards with no more than 50,000 URLs per shard. Every catalog video must appear once in the video sitemap with its clean canonical page URL, source thumbnail, title, concise description, player location, and duration when valid. Full views and source-backed tags remain on the HTML page and VideoObject schema; optional sitemap fields may be added only when they remain factual and operationally safe. `robots.txt` must continue to allow the canonical video routes and point to `https://nexusxxx.site/sitemap.xml`.

Only substantive categories, tags, and performers should receive indexable landing pages. Keep low-volume or duplicate facets out of the index rather than generating doorway pages. Performer pages must be based on an explicit source performer field; never infer performer identity from a title or fabricate names.

Before committing, run `node --check js/app.js`, the SEO, Edge, feed, preview-parity, ads, recommendations, and Python validators, plus `git diff --check`. Confirm the catalog count, unique video IDs, clean URL count, sitemap count, canonical count, and `note.md` workflow. Do not commit unrelated working-tree changes such as `tools/update_embeddings_audit.py`.
