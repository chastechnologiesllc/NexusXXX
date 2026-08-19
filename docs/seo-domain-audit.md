# nexusxxx.site SEO and domain audit

## Repository findings

The repository already contains an SEO package with a generated search-term index, category landing-page generation, a sitemap generator, and validation reports. However, `seo/site-config.json` still has an empty `siteUrl` and `status: domain-not-configured`. The root `sitemap.xml` is missing, and `robots.txt` contains only a commented instruction to generate one after configuring the domain.

The static pages currently use relative canonical URLs such as `/` and `/pages/popular.html`. They do not consistently expose an absolute `og:url`, and the shared parameterized player route remains a client-rendered shell. The player script updates Open Graph title/image metadata at runtime, but a crawler that does not execute the page script will not see a unique per-video title, thumbnail, or structured video record in the initial HTML.

## Google video-search findings

Google’s official VideoObject guidance lists `name`, `thumbnailUrl`, and `uploadDate` as required properties. It recommends `contentUrl`, `description`, `duration`, and `embedUrl` among other properties. Structured data must represent visible page content and does not guarantee a rich result.

Google’s video SEO guidance emphasizes that videos need stable URLs, a dedicated watch page for each video, a high-quality thumbnail, and consistent unique information in the page and structured data. Third-party embedded players are supported, but the watch page and video metadata still need to be discoverable.

The current `/pages/video.html?id=...` route is a shared client-rendered shell. Production SEO should therefore either keep it `noindex` and create crawlable static watch pages, or generate a unique static document for each indexable video. Because the catalog contains millions of records, a bounded indexable set should be generated from the curated/SEO-approved catalog rather than emitting millions of thin pages or query-result URLs.

## Live-domain findings

`https://nexusxxx.site/` resolves to Netlify but currently returns a private-site login/protection response with HTTP 401. The `www` host redirects to the apex domain, HTTP redirects to HTTPS, and `robots.txt` and `sitemap.xml` are also hidden behind the same protection. Search engines cannot crawl or index the production site until Netlify Team protection is disabled for public production access or a public deployment context is configured.

## Canonicalization and JavaScript findings

Google treats canonical tags, redirects, sitemap inclusion, and HTTPS as signals rather than absolute commands [3]. The new domain should therefore be used consistently in all of them, with one preferred apex origin and a redirect from `www`.

Google processes JavaScript through crawling, rendering, and indexing, but server-side or pre-rendering is still recommended for speed and for bots that do not execute JavaScript [4]. The current feed renders most video links dynamically, while the category pages contain static links to the shared parameterized player route. Production SEO should expose unique static watch-page URLs for the bounded indexable catalog rather than relying on client-side query parameters.

## Initial source URLs

- https://developers.google.com/search/docs/appearance/structured-data/video
- https://developers.google.com/search/docs/appearance/video

## Implementation direction

Use `https://nexusxxx.site` as the sole production origin, configure it centrally in `seo/site-config.json`, generate and commit `sitemap.xml`, add an absolute `Sitemap:` directive, and replace relative canonical/Open Graph URLs in indexable static pages. Improve search matching through the existing real-tag/category index and useful aliases only; do not create hidden keyword blocks or doorway pages.

Create static, indexable watch pages only for the bounded SEO-approved catalog set. Each page should contain a stable canonical URL, unique title and description, the actual thumbnail URL, visible video title and metadata, an official embed, and representative VideoObject JSON-LD. The current export does not contain a trustworthy provider publication date, so the generated schema intentionally does not fabricate `uploadDate`; adding an observed source date later should be done only after verifying its semantics. Keep the generic client-rendered route usable for navigation but `noindex, follow` if it remains non-unique.

## References

[1]: https://developers.google.com/search/docs/appearance/structured-data/video "Google Search Central: Video structured data"

[2]: https://developers.google.com/search/docs/appearance/video "Google Search Central: Video SEO best practices"

[3]: https://developers.google.com/search/docs/crawling-indexing/canonicalization "Google Search Central: Canonicalization"

[4]: https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics "Google Search Central: JavaScript SEO basics"
