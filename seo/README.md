# NexusXXX SEO Package

This directory contains the domain-neutral SEO package for the static site. The package is designed to improve crawlability and search relevance without hidden keyword blocks, doorway pages, or misleading structured data.

## What is included

The generated `js/search/index.json` maps observed catalog tags and category names to relevant category slugs. The browser uses it to resolve full and tokenized search queries to real catalog content. The generated `pages/category/*.html` files provide substantive landing pages with a visible heading, description, featured links, internal navigation, and matching `CollectionPage`/`ItemList` structured data. The page set contains only categories with at least 20 catalog records for ordinary indexing; small categories remain available through the application but are not promoted as thin landing pages.

The generic parameterized player route, `pages/video.html?id=...`, is marked `noindex, follow` because it is a shared client-rendered shell rather than a unique server-rendered document. It remains fully usable for visitors and receives internal links from the category pages.

## Configure the production domain

The production package is configured for `https://nexusxxx.site`. If the domain changes later, edit `seo/site-config.json` first and regenerate all SEO assets before deployment:

```json
{
  "siteUrl": "https://nexusxxx.site"
}
```

Then regenerate the sitemap:

```bash
python3 tools/generate_sitemap.py
```

The generator writes absolute canonical/Open Graph URLs, bounded static watch pages, and a production sitemap. Keep the `Sitemap: https://nexusxxx.site/sitemap.xml` directive in `robots.txt`. The sitemap includes the homepage, primary browse pages, substantive category landing pages, and the bounded SEO-approved watch-page set; search/filter query URLs remain non-indexable.

## Search quality policy

The keyword index is derived from real catalog tags and category names, with a small set of user-facing aliases such as “watch porn” and “popular porn” mapped only to relevant categories. It is not rendered as hidden text, and it does not generate a page for every synonym or query. Future expansions should add a keyword only when it represents a real user intent and maps to visible content that helps the visitor.

This approach follows [Google Search Central’s spam policies](https://developers.google.com/search/docs/essentials/spam-policies), which prohibit keyword stuffing, scaled pages created primarily to manipulate rankings, and scraped pages without substantial added value. Structured data should remain representative of visible page content and does not guarantee rankings or rich-result display; see Google’s [general structured-data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).
