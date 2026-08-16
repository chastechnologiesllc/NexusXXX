# NexusXXX Embeddings Progress Log

**File:** `embeddings.md`  
**Last updated:** August 2026  
**Current catalog size:** 10,438 unique videos  
**Architecture:** Split catalog (`js/data.js` featured + `js/catalog/*.json` on-demand)

---

## How the catalog is built

Source data lives in:
```
data/pornhub-db-split/categories/{slug}/part-XXXX.csv
```

Each CSV is pipe-delimited (`|`) with 13 fields. We extract:
- Official Pornhub embed ID from `embed_html`
- Thumbnail, title, tags, duration, views
- Keep only high-view videos with valid CDN thumbs
- Deduplicate by video ID across all categories

Output structure:
```
js/
├── data.js              ← Featured ~1,500 videos (fast first paint)
├── app.js               ← On-demand category loader
└── catalog/
    ├── index.json
    ├── amateur.json
    ├── asian.json
    └── ... (one JSON per category)
```

---

## CSVs ALREADY USED

These parts have been processed and contributed videos to the current 10,438 catalog.

| Category folder (slug) | Parts used | Total parts available | Remaining parts |
|------------------------|------------|-----------------------|-----------------|
| `amateur` | 0001, 0002, 0003, 0004, 0005, 0006, 0007, 0008, 0009, 0010 | 100 | **90** |
| `big-ass` | 0001, 0002, 0003, 0004, 0005, 0006 | 30 | **24** |
| `babe` | 0001, 0002, 0003, 0004 | 18 | **14** |
| `asian` | 0001, 0002, 0003, 0004 | 17 | **13** |
| `big-dick` | 0001, 0002, 0003 | 14 | **11** |
| `big-tits` | 0001, 0002, 0003 | 9 | **6** |
| `solo-male` | 0001 | 7 | **6** |
| `fetish` | 0001, 0002 | 6 | **4** |
| `blowjob` | 0001, 0002 | 5 | **3** |
| `brunette` | 0001, 0002 | 5 | **3** |
| `bareback` | 0001 | 4 | **3** |
| `masturbation` | 0001 | 4 | **3** |
| `blonde` | 0001, 0002 | 4 | **2** |
| `cumshot` | 0001 | 3 | **2** |
| `bbw` | 0001 | 3 | **2** |
| `euro` | 0001 | 2 | **1** |
| `daddy` | 0001 | 2 | **1** |
| `orgy` | 0001 | 2 | **1** |
| `creampie` | 0001 | 2 | **1** |
| `black` | 0001 | 2 | **1** |
| `exclusive` | 0001 | 2 | **1** |
| `latino` | 0001 | 1 | **0** |
| `toys` | 0001 | 1 | **0** |
| `bondage` | 0001 | 1 | **0** |
| `muscle` | 0001 | 1 | **0** |
| `ebony` | 0001 | 1 | **0** |
| `18-25` | 0001 | 1 | **0** |
| `hardcore` | 0001 | 1 | **0** |
| `handjob` | 0001 | 1 | **0** |
| `japanese` | 0001 | 1 | **0** |
| `cartoon` | 0001 | 1 | **0** |
| `verified-amateurs` | 0001 | 1 | **0** |
| `transgender` | 0001 | 1 | **0** |
| `lesbian` | 0001 | 1 | **0** |
| `pornstar` | 0001 | 1 | **0** |
| `anal` | 0001 | 1 | **0** |
| `hentai` | 0001 | 1 | **0** |
| `massage` | 0001 | 1 | **0** |
| `milf` | 0001 | 1 | **0** |
| `latina` | 0001 | 1 | **0** |
| `public` | 0001 | 1 | **0** |
| `pov` | 0001 | 1 | **0** |
| `feet` | 0001 | 1 | **0** |
| `reality` | 0001 | 1 | **0** |
| `mature` | 0001 | 1 | **0** |
| `interracial` | 0001 | 1 | **0** |
| `bukkake` | 0001 | 1 | **0** |
| `college-18` | 0001 | 1 | **0** |
| `small-tits` | 0001 | 1 | **0** |
| `role-play` | 0001 | 1 | **0** |
| `webcam` | 0001 | 1 | **0** |
| `compilation` | 0001 | 1 | **0** |
| `squirt` | 0001 | 1 | **0** |
| `red-head` | 0001 | 1 | **0** |
| `threesome` | 0001 | 1 | **0** |
| `solo-female` | 0001 | 1 | **0** |
| `rough-sex` | 0001 | 1 | **0** |
| `vintage` | 0001 | 1 | **0** |
| `casting` | 0001 | 1 | **0** |
| `gangbang` | 0001 | 1 | **0** |
| `double-penetration` | 0001 | 1 | **0** |
| `cosplay` | 0001 | 1 | **0** |

**Total category folders touched:** 62

---

## CSVs NOT YET TOUCHED

These categories (or remaining parts) have **zero** contribution so far, or still have unused parts.

### A. Categories with remaining parts (highest priority for growth)

| Category slug | Parts already used | Next part to use | Parts still available |
|---------------|--------------------|------------------|-----------------------|
| `amateur` | 1,2,3,4,5,6,7,8,9,10 | **part-0011.csv** | 90 of 100 |
| `big-ass` | 1,2,3,4,5,6 | **part-0007.csv** | 24 of 30 |
| `babe` | 1,2,3,4 | **part-0005.csv** | 14 of 18 |
| `asian` | 1,2,3,4 | **part-0005.csv** | 13 of 17 |
| `big-dick` | 1,2,3 | **part-0004.csv** | 11 of 14 |
| `big-tits` | 1,2,3 | **part-0004.csv** | 6 of 9 |
| `solo-male` | 1 | **part-0002.csv** | 6 of 7 |
| `fetish` | 1,2 | **part-0003.csv** | 4 of 6 |
| `blowjob` | 1,2 | **part-0003.csv** | 3 of 5 |
| `brunette` | 1,2 | **part-0003.csv** | 3 of 5 |
| `bareback` | 1 | **part-0002.csv** | 3 of 4 |
| `masturbation` | 1 | **part-0002.csv** | 3 of 4 |
| `twink-18` | — | **part-0001.csv** | 3 of 3 |
| `blonde` | 1,2 | **part-0003.csv** | 2 of 4 |
| `cumshot` | 1 | **part-0002.csv** | 2 of 3 |
| `bbw` | 1 | **part-0002.csv** | 2 of 3 |
| `euro` | 1 | **part-0002.csv** | 1 of 2 |
| `daddy` | 1 | **part-0002.csv** | 1 of 2 |
| `orgy` | 1 | **part-0002.csv** | 1 of 2 |
| `creampie` | 1 | **part-0002.csv** | 1 of 2 |
| `black` | 1 | **part-0002.csv** | 1 of 2 |
| `exclusive` | 1 | **part-0002.csv** | 1 of 2 |
| `gay` | — | **part-0001.csv** | 1 of 1 |
| `celebrity` | — | **part-0001.csv** | 1 of 1 |
| `fisting` | — | **part-0001.csv** | 1 of 1 |
| `sfw` | — | **part-0001.csv** | 1 of 1 |
| `60fps` | — | **part-0001.csv** | 1 of 1 |
| `smoking` | — | **part-0001.csv** | 1 of 1 |
| `party` | — | **part-0001.csv** | 1 of 1 |
| `bisexual-male` | — | **part-0001.csv** | 1 of 1 |
| `school-18` | — | **part-0001.csv** | 1 of 1 |
| `group` | — | **part-0001.csv** | 1 of 1 |
| `verified-models` | — | **part-0001.csv** | 1 of 1 |
| `babysitter-18` | — | **part-0001.csv** | 1 of 1 |
| `italian` | — | **part-0001.csv** | 1 of 1 |
| `russian` | — | **part-0001.csv** | 1 of 1 |
| `british` | — | **part-0001.csv** | 1 of 1 |
| `virtual-reality` | — | **part-0001.csv** | 1 of 1 |
| `striptease` | — | **part-0001.csv** | 1 of 1 |
| `german` | — | **part-0001.csv** | 1 of 1 |
| `brazilian` | — | **part-0001.csv** | 1 of 1 |
| `czech` | — | **part-0001.csv** | 1 of 1 |
| `pussy-licking` | — | **part-0001.csv** | 1 of 1 |
| `music` | — | **part-0001.csv** | 1 of 1 |
| `french` | — | **part-0001.csv** | 1 of 1 |
| `uncategorized` | — | **part-0001.csv** | 1 of 1 |
| `funny` | — | **part-0001.csv** | 1 of 1 |
| `korean` | — | **part-0001.csv** | 1 of 1 |
| `arab` | — | **part-0001.csv** | 1 of 1 |
| `behind-the-scenes` | — | **part-0001.csv** | 1 of 1 |
| `indian` | — | **part-0001.csv** | 1 of 1 |
| `step-fantasy` | — | **part-0001.csv** | 1 of 1 |
| `pissing` | — | **part-0001.csv** | 1 of 1 |
| `popular-with-women` | — | **part-0001.csv** | 1 of 1 |
| `gaming` | — | **part-0001.csv** | 1 of 1 |
| `cuckold` | — | **part-0001.csv** | 1 of 1 |
| `female-orgasm` | — | **part-0001.csv** | 1 of 1 |
| `parody` | — | **part-0001.csv** | 1 of 1 |
| `vertical-video` | — | **part-0001.csv** | 1 of 1 |
| `bear` | — | **part-0001.csv** | 1 of 1 |
| `old-young-18` | — | **part-0001.csv** | 1 of 1 |
| `verified-couples` | — | **part-0001.csv** | 1 of 1 |
| `180` | — | **part-0001.csv** | 1 of 1 |
| `straight-guys` | — | **part-0001.csv** | 1 of 1 |
| `360` | — | **part-0001.csv** | 1 of 1 |
| `romantic` | — | **part-0001.csv** | 1 of 1 |
| `culture-society` | — | **part-0001.csv** | 1 of 1 |
| `described-video` | — | **part-0001.csv** | 1 of 1 |
| `hd-porn` | — | **part-0001.csv** | 1 of 1 |
| `hunks` | — | **part-0001.csv** | 1 of 1 |
| `muscular-men` | — | **part-0001.csv** | 1 of 1 |
| `news-commentary` | — | **part-0001.csv** | 1 of 1 |
| `podcast` | — | **part-0001.csv** | 1 of 1 |
| `scissoring` | — | **part-0001.csv** | 1 of 1 |
| `tattooed-women` | — | **part-0001.csv** | 1 of 1 |
| `trans-male` | — | **part-0001.csv** | 1 of 1 |
| `trans-with-guy` | — | **part-0001.csv** | 1 of 1 |
| `uncensored` | — | **part-0001.csv** | 1 of 1 |

### B. Categories never touched (entirely unused)

These folders exist in `data/pornhub-db-split/categories/` but no part was ever processed:

| Category slug | Available parts |
|---------------|-----------------|
| `twink-18` | 3 |
| `180` | 1 |
| `360` | 1 |
| `60fps` | 1 |
| `arab` | 1 |
| `babysitter-18` | 1 |
| `bear` | 1 |
| `behind-the-scenes` | 1 |
| `bisexual-male` | 1 |
| `brazilian` | 1 |
| `british` | 1 |
| `celebrity` | 1 |
| `cuckold` | 1 |
| `culture-society` | 1 |
| `czech` | 1 |
| `described-video` | 1 |
| `female-orgasm` | 1 |
| `fisting` | 1 |
| `french` | 1 |
| `funny` | 1 |
| `gaming` | 1 |
| `gay` | 1 |
| `german` | 1 |
| `group` | 1 |
| `hd-porn` | 1 |
| `hunks` | 1 |
| `indian` | 1 |
| `italian` | 1 |
| `korean` | 1 |
| `muscular-men` | 1 |
| `music` | 1 |
| `news-commentary` | 1 |
| `old-young-18` | 1 |
| `parody` | 1 |
| `party` | 1 |
| `pissing` | 1 |
| `podcast` | 1 |
| `popular-with-women` | 1 |
| `pussy-licking` | 1 |
| `romantic` | 1 |
| `russian` | 1 |
| `sfw` | 1 |
| `school-18` | 1 |
| `scissoring` | 1 |
| `smoking` | 1 |
| `step-fantasy` | 1 |
| `straight-guys` | 1 |
| `striptease` | 1 |
| `tattooed-women` | 1 |
| `trans-male` | 1 |
| `trans-with-guy` | 1 |
| `uncategorized` | 1 |
| `uncensored` | 1 |
| `verified-couples` | 1 |
| `verified-models` | 1 |
| `vertical-video` | 1 |
| `virtual-reality` | 1 |

**Completely untouched categories:** 57

---

## WHERE TO CONTINUE (clear instructions)

When you want to increase the video count, follow this exact order:

### Recommended next batch order (highest yield first)

1. **Amateur** — next is `part-0011.csv` → continue through `part-0100.csv` (90 parts left)
2. **Big Ass** — next is `part-0007.csv` → through `part-0030.csv` (24 parts left)
3. **Babe** — next is `part-0005.csv` → through `part-0018.csv` (14 parts left)
4. **Asian** — next is `part-0005.csv` → through `part-0017.csv` (13 parts left)
5. **Big Dick** — next is `part-0004.csv` → through `part-0014.csv` (11 parts left)
6. **Big Tits** — next is `part-0004.csv` → through `part-0009.csv` (6 parts left)
7. **Solo Male** — start at `part-0001.csv` (7 parts, never touched deeply beyond what was sampled)
8. **Fetish** — next is `part-0003.csv` → through `part-0006.csv`
9. **Blowjob** — next is `part-0003.csv` → through `part-0005.csv`
10. **Brunette / Blonde** — next parts after 0002

### Exact commands to continue (example for next Amateur parts)

```bash
# 1. Download next parts
curl -sL -o am11.csv https://raw.githubusercontent.com/chastechnologiesllc/NexusXXX/main/data/pornhub-db-split/categories/amateur/part-0011.csv
curl -sL -o am12.csv https://raw.githubusercontent.com/chastechnologiesllc/NexusXXX/main/data/pornhub-db-split/categories/amateur/part-0012.csv
# ... repeat for more parts

# 2. Process with the same Python logic used in previous batches
#    (extract embed ID, filter by min_views, dedupe by id, merge into catalog_merged.json)

# 3. Rebuild the split:
#    - Update js/catalog/{slug}.json for affected categories
#    - Regenerate featured set in js/data.js (top N by views)
#    - Update CATALOG_INDEX + CATEGORIES if new categories appear
```

### Rules to keep quality high

- Always prefer **higher view counts** (raise or lower `min_views` depending on how many new videos you need)
- Always **deduplicate by video `id`** across the whole library
- Keep category JSON files under ~250 videos each for fast loading (or raise the cap intentionally)
- Featured set in `data.js` should stay around 1,000–2,000 for fast first paint
- Only use official `https://www.pornhub.com/embed/{id}` URLs

---

## Quick reference — next part numbers

```
amateur/part-0011.csv          ← START HERE for maximum volume
big-ass/part-0007.csv
babe/part-0005.csv
asian/part-0005.csv
big-dick/part-0004.csv
big-tits/part-0004.csv
blonde/part-0003.csv
brunette/part-0003.csv
blowjob/part-0003.csv
fetish/part-0003.csv
bareback/part-0002.csv
masturbation/part-0002.csv
cumshot/part-0002.csv
euro/part-0002.csv
daddy/part-0002.csv
orgy/part-0002.csv
creampie/part-0002.csv
black/part-0002.csv
exclusive/part-0002.csv
solo-male/part-0002.csv     (if more depth wanted)
```

---

## Current library snapshot (at time of this file)

| Metric | Value |
|--------|-------|
| Total unique videos | 10,438 |
| Featured videos | 1,500 |
| Categories with data | 61 |
| Source | Official Pornhub embeds only |
| Selection | Highest views per processed part |

When you continue, update this file:
1. Move the newly processed parts from "NOT YET TOUCHED" into "ALREADY USED"
2. Update the "next part" numbers
3. Update the total video count

---

*This file is the single source of truth for embedding progress. Keep it updated every batch.*
