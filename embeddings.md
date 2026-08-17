# NexusXXX Full Catalog Audit and Embedding Progress

**Status:** Complete corpus ingestion and split-catalog integration completed on **2026-08-17**. This document is the source of truth for the current embedding/catalog build.

> All **341 tracked CSV part files** under `data/pornhub-db-split/categories/` were scanned. The website now has a deduplicated, categorized representation of **4,797,000 unique videos**. The browser loads the featured set immediately and streams the complete category catalog through indexed JSON chunks.

## 1. Production snapshot

| Metric | Audited value |
|---|---:|
| CSV part files scanned | **341** |
| Source data rows scanned | **4,797,027** |
| Rows with valid 13-field structure | **4,797,027** |
| Rows rejected for missing/invalid record data | **27** |
| Unique videos after embed-ID deduplication | **4,797,000** |
| Previous published catalog entries | **10,438** |
| Previous unique IDs measured from published catalog | **6,818** |
| Previous IDs retained in the full corpus | **6,818** |
| Net new unique IDs added | **4,790,182** |
| Canonical output categories | **119** |
| Category JSON chunks | **289** |
| Featured videos in `js/data.js` | **1,500** |
| Records per category chunk | **25,000** |
| Source policy | Official Pornhub embed URLs only |

The earlier catalog’s index total counted category entries rather than a fully deduplicated global ID set. The audit therefore records both the historical published entry count and the measured unique-ID count; the new build uses one global embed-ID key and keeps the highest-view record when duplicates are encountered.

## 2. Source and extraction contract

Source files are stored in:

```text
data/pornhub-db-split/categories/{source-slug}/part-XXXX.csv
```

Each part is pipe-delimited and has the following 13-field header:

```text
embed_html | thumbnail | thumbnail_sequence | title | tags | categories |
performer | duration_seconds | views | source_metric_1 | source_metric_2 |
thumbnail_large | thumbnail_sequence_large
```

The builder extracts the official embed ID from `embed_html`, chooses a valid CDN thumbnail, normalizes duration and views, preserves title and tags, assigns a canonical primary category, and emits only `https://www.pornhub.com/embed/{id}` player URLs. A global ID conflict keeps the record with the higher view count. The 27 rejected rows had no usable complete record after these validation rules; no CSV part was skipped.

## 3. Website output structure

```text
js/
├── data.js                         # 1,500 featured videos for first paint
├── app.js                          # manifest-driven progressive loader
└── catalog/
    ├── index.json                  # category manifest and corpus totals
    ├── amateur/part-0001.json
    ├── amateur/part-0002.json
    ├── ...                         # 289 indexed category chunks
    └── ...
```

`js/catalog/index.json` contains the complete category manifest. Each category entry records its canonical name, slug, total count, part count, and ordered chunk paths. The application first loads `data.js`, then fetches one category chunk at a time through **Load more videos**; this keeps first paint and category navigation practical while making every indexed record reachable. The loader supports root and `/pages/` routes, bounded requests, cached chunks, progress counts, and legacy single-file fallback.

## 4. Complete CSV coverage

The following table is generated from the repository inventory. `Source rows` excludes the one header row in each CSV part. `Canonical output` shows the website slug used by the new catalog; aliases such as `18-25 → teen`, `college-18 → college`, and `red-head → redhead` are normalized during ingestion.

| Source category | Parts scanned | Source rows | Canonical output |
|---|---:|---:|---|
| `18-25` | 1 | 14,407 | `teen` (Teen) |
| `180` | 1 | 4 | `180` (180) |
| `360` | 1 | 2 | `360` (360) |
| `60fps` | 1 | 905 | `60fps` (60fps) |
| `amateur` | 100 | 1,914,135 | `amateur` (Amateur) |
| `anal` | 1 | 9,014 | `anal` (Anal) |
| `arab` | 1 | 56 | `arab` (Arab) |
| `asian` | 17 | 319,656 | `asian` (Asian) |
| `babe` | 18 | 337,980 | `babe` (Babe) |
| `babysitter-18` | 1 | 248 | `babysitter-18` (Babysitter 18) |
| `bareback` | 4 | 75,019 | `bareback` (Bareback) |
| `bbw` | 3 | 45,261 | `bbw` (BBW) |
| `bear` | 1 | 8 | `bear` (Bear) |
| `behind-the-scenes` | 1 | 46 | `behind-the-scenes` (Behind the Scenes) |
| `big-ass` | 30 | 572,823 | `big-ass` (Big Ass) |
| `big-dick` | 14 | 254,794 | `big-dick` (Big Dick) |
| `big-tits` | 9 | 167,289 | `big-tits` (Big Tits) |
| `bisexual-male` | 1 | 614 | `bisexual-male` (Bisexual Male) |
| `black` | 2 | 26,775 | `black` (Black) |
| `blonde` | 4 | 76,492 | `blonde` (Blonde) |
| `blowjob` | 5 | 80,457 | `blowjob` (Blowjob) |
| `bondage` | 1 | 17,648 | `bondage` (Bondage) |
| `brazilian` | 1 | 99 | `brazilian` (Brazilian) |
| `british` | 1 | 155 | `british` (British) |
| `brunette` | 5 | 79,339 | `brunette` (Brunette) |
| `bukkake` | 1 | 2,536 | `bukkake` (Bukkake) |
| `cartoon` | 1 | 11,480 | `cartoon` (Cartoon) |
| `casting` | 1 | 264 | `casting` (Casting) |
| `celebrity` | 1 | 5,922 | `celebrity` (Celebrity) |
| `college-18` | 1 | 1,972 | `college` (College) |
| `compilation` | 1 | 1,318 | `compilation` (Compilation) |
| `cosplay` | 1 | 7 | `cosplay` (Cosplay) |
| `creampie` | 2 | 28,363 | `creampie` (Creampie) |
| `cuckold` | 1 | 11 | `cuckold` (Cuckold) |
| `culture-society` | 1 | 1 | `culture-society` (Culture Society) |
| `cumshot` | 3 | 45,534 | `cumshot` (Cumshot) |
| `czech` | 1 | 98 | `czech` (Czech) |
| `daddy` | 2 | 32,290 | `daddy` (Daddy) |
| `described-video` | 1 | 1 | `described-video` (Described Video) |
| `double-penetration` | 1 | 96 | `double-penetration` (Double Penetration) |
| `ebony` | 1 | 14,868 | `ebony` (Ebony) |
| `euro` | 2 | 35,235 | `euro` (Euro) |
| `exclusive` | 2 | 21,000 | `exclusive` (Exclusive) |
| `feet` | 1 | 4,916 | `feet` (Feet) |
| `female-orgasm` | 1 | 10 | `female-orgasm` (Female Orgasm) |
| `fetish` | 6 | 98,673 | `fetish` (Fetish) |
| `fisting` | 1 | 3,080 | `fisting` (Fisting) |
| `french` | 1 | 86 | `french` (French) |
| `funny` | 1 | 76 | `funny` (Funny) |
| `gaming` | 1 | 12 | `gaming` (Gaming) |
| `gangbang` | 1 | 168 | `gangbang` (Gangbang) |
| `gay` | 1 | 6,234 | `gay` (Gay) |
| `german` | 1 | 119 | `german` (German) |
| `group` | 1 | 344 | `group` (Group) |
| `handjob` | 1 | 14,322 | `handjob` (Handjob) |
| `hardcore` | 1 | 14,359 | `hardcore` (Hardcore) |
| `hd-porn` | 1 | 1 | `hd-porn` (HD Porn) |
| `hentai` | 1 | 8,446 | `hentai` (Hentai) |
| `hunks` | 1 | 1 | `hunks` (Hunks) |
| `indian` | 1 | 33 | `indian` (Indian) |
| `interracial` | 1 | 2,791 | `interracial` (Interracial) |
| `italian` | 1 | 246 | `italian` (Italian) |
| `japanese` | 1 | 13,981 | `japanese` (Japanese) |
| `korean` | 1 | 66 | `korean` (Korean) |
| `latina` | 1 | 6,705 | `latina` (Latina) |
| `latino` | 1 | 18,756 | `latino` (Latino) |
| `lesbian` | 1 | 10,882 | `lesbian` (Lesbian) |
| `massage` | 1 | 7,740 | `massage` (Massage) |
| `masturbation` | 4 | 61,816 | `masturbation` (Masturbation) |
| `mature` | 1 | 3,065 | `mature` (Mature) |
| `milf` | 1 | 7,478 | `milf` (Milf) |
| `muscle` | 1 | 16,378 | `muscle` (Muscle) |
| `muscular-men` | 1 | 1 | `muscular-men` (Muscular Men) |
| `music` | 1 | 94 | `music` (Music) |
| `news-commentary` | 1 | 1 | `news-commentary` (News Commentary) |
| `old-young-18` | 1 | 8 | `old-young-18` (Old Young 18) |
| `orgy` | 2 | 31,846 | `orgy` (Orgy) |
| `parody` | 1 | 10 | `parody` (Parody) |
| `party` | 1 | 674 | `party` (Party) |
| `pissing` | 1 | 20 | `pissing` (Pissing) |
| `podcast` | 1 | 1 | `podcast` (Podcast) |
| `popular-with-women` | 1 | 15 | `popular-with-women` (Popular With Women) |
| `pornstar` | 1 | 9,864 | `pornstar` (Pornstar) |
| `pov` | 1 | 4,928 | `pov` (POV) |
| `public` | 1 | 6,534 | `public` (Public) |
| `pussy-licking` | 1 | 97 | `pussy-licking` (Pussy Licking) |
| `reality` | 1 | 3,470 | `reality` (Reality) |
| `red-head` | 1 | 921 | `redhead` (Redhead) |
| `role-play` | 1 | 1,628 | `role-play` (Role Play) |
| `romantic` | 1 | 2 | `romantic` (Romantic) |
| `rough-sex` | 1 | 536 | `rough-sex` (Rough Sex) |
| `russian` | 1 | 159 | `russian` (Russian) |
| `school-18` | 1 | 361 | `school-18` (School 18) |
| `scissoring` | 1 | 1 | `scissoring` (Scissoring) |
| `sfw` | 1 | 2,263 | `sfw` (SFW) |
| `small-tits` | 1 | 1,752 | `small-tits` (Small Tits) |
| `smoking` | 1 | 692 | `smoking` (Smoking) |
| `solo-female` | 1 | 554 | `solo-female` (Solo Female) |
| `solo-male` | 7 | 135,548 | `solo-male` (Solo Male) |
| `squirt` | 1 | 984 | `squirt` (Squirt) |
| `step-fantasy` | 1 | 26 | `step-fantasy` (Step Fantasy) |
| `straight-guys` | 1 | 3 | `straight-guys` (Straight Guys) |
| `striptease` | 1 | 124 | `striptease` (Striptease) |
| `tattooed-women` | 1 | 1 | `tattooed-women` (Tattooed Women) |
| `threesome` | 1 | 669 | `threesome` (Threesome) |
| `toys` | 1 | 18,103 | `toys` (Toys) |
| `trans-male` | 1 | 1 | `trans-male` (Trans Male) |
| `trans-with-guy` | 1 | 1 | `trans-with-guy` (Trans With Guy) |
| `transgender` | 1 | 11,346 | `transgender` (Transgender) |
| `twink-18` | 3 | 55,119 | `twink-18` (Twink 18) |
| `uncategorized` | 1 | 82 | `uncategorized` (Uncategorized) |
| `uncensored` | 1 | 1 | `uncensored` (Uncensored) |
| `verified-amateurs` | 1 | 11,351 | `verified-amateurs` (Verified Amateurs) |
| `verified-couples` | 1 | 5 | `verified-couples` (Verified Couples) |
| `verified-models` | 1 | 267 | `verified-models` (Verified Models) |
| `vertical-video` | 1 | 10 | `vertical-video` (Vertical Video) |
| `vintage` | 1 | 316 | `vintage` (Vintage) |
| `virtual-reality` | 1 | 150 | `virtual-reality` (Virtual Reality) |
| `webcam` | 1 | 1,482 | `webcam` (Webcam) |

**Coverage result:** every tracked CSV part is included in the `341`-part audit, and the complete source corpus is represented by the `4,797,000`-video deduplicated catalog.

## 5. Validation performed

The completed build passed the following checks:

| Check | Result |
|---|---|
| CSV part discovery | All `341` tracked parts discovered |
| Field shape | No malformed 13-field rows |
| Global deduplication | `4,797,000` unique IDs; no duplicate output IDs |
| Category integrity | `119` categories match manifest totals |
| Chunk integrity | `289` JSON chunks match manifest paths and counts |
| Record schema | Required fields present on every emitted record |
| Embed policy | Every emitted player URL is an official Pornhub embed URL |
| Thumbnail policy | Every emitted thumbnail uses an approved Pornhub CDN prefix |
| JavaScript syntax | `js/data.js` and `js/app.js` pass `node --check` |
| JSON syntax | Every generated JSON file parses successfully |
| Website loading contract | `app.js` reads `index.json`, streams category chunks, and reports loaded/total counts |

## 6. Reproducibility tools

The repository now includes the following audited tools:

| Tool | Purpose |
|---|---|
| `tools/build_full_catalog.py` | Stream all CSV parts into a SQLite-backed deduplicated catalog and generate outputs |
| `tools/rebuild_catalog_outputs.py` | Rebuild JSON chunks and `data.js` from an existing deduplication database |
| `tools/validate_full_catalog.py` | Validate every generated record, chunk, category total, ID, embed, and thumbnail |
| `tools/compare_catalog_ids.py` | Measure overlap between a previous catalog ID set and a new corpus |
| `tools/split_pornhub_db.py` | Preserve the original source-archive splitter and manifest workflow |
| `tools/validate_pornhub_db_split.py` | Preserve validation for the source split archive |

To repeat the production build, run the builder against `data/pornhub-db-split/categories`, validate the staged `js/catalog`, review the generated index, then deploy the staged `js/` tree. Do not commit the temporary SQLite database or staging directory.

## 7. Current continuation point

The prior “remaining CSV” checkpoint is now closed. There are **no remaining unprocessed CSV parts** in the tracked corpus. Any future additions should be placed in a new, explicitly numbered batch and recorded here with the source files, row counts, deduplication result, output chunk changes, and validation report.

*Generated from the repository audit by Manus AI.*
