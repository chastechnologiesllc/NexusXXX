# NexusXXX — Professional Free Adult Tube (Embed-Based)

Pure frontend static site that embeds official players from major tube platforms (Pornhub, XVideos, Redtube, YouPorn, Tube8, xHamster, XNXX, EPorner, etc.).

## Features

- Clean, modern dark professional UI
- Age-gate (18+) with localStorage
- Responsive video grid + player page
- Reliable embedded-player recovery on first load and browser back/forward navigation
- Thumbnail shimmer loading, one-time network retry, and readable broken-image fallback
- Categories, search, sort (newest / popular)
- Share buttons (native Web Share API + copy link + Twitter/Reddit)
- SEO-ready: meta tags, Open Graph, VideoObject schema, semantic HTML
- Manageable ad slots (top banner, mid, sidebar, bottom) ready for ExoClick / TrafficStars / TrafficJunky / JuicyAds etc.
- Full legal pages: Terms, Privacy, DMCA, 18 U.S.C. § 2257 statement, Cookies, Law Enforcement, Contact, FAQ
- No video hosting — only official embeds (respects source ToS when used correctly)

## Important Legal Notes

- **GitHub Pages**: GitHub prohibits sexually obscene / pornographic content. Do **not** host the live site on GitHub Pages. Use the repo only for source control. Deploy to adult-friendly hosting (many specialized VPS/CDN providers exist).
- This site is designed as an **embed aggregator**. You are not the producer of the videos. The 2257 page reflects that exemption; still include the statement and keep records for any of your own marketing materials.
- Age-verification laws exist in many U.S. states and other countries. The built-in gate is a basic first step; stronger third-party age verification may be required depending on your traffic sources and jurisdiction.
- Always use **official embed codes** only. Scraping or unauthorized extraction can violate source platform Terms of Service and copyright law.
- Register a DMCA agent with the U.S. Copyright Office if you want full safe-harbor protection and update the DMCA page with the registered details.
- Replace placeholder contact/address information with your real operator details.

## Current Data

The catalog in `js/data.js` is populated with **real Pornhub Webmaster feed** data (40 videos). Each entry uses the official Pornhub embed URL, real thumbnails from PH CDN, and accurate durations extracted from the feed.

## How to Add More Videos

1. Export additional rows from your Pornhub Webmaster account (CSV containing title, link/viewkey, duration_seconds, thumbs, embed code).
2. Convert each new row into the same object shape used in `js/data.js` (`id` = viewkey, `embedSrc` = official embed URL, etc.).
3. Append the objects to the `VIDEOS` array. Categories are inferred from titles but can be manually set.
4. Always use official embed codes only — never hotlink or scrape video files.

## Ads (Testing)

Placeholder slots are marked in the HTML. For testing:

- Sign up with adult networks (ExoClick, TrafficStars, TrafficJunky, JuicyAds, HilltopAds, etc.).
- Create zones for 728×90, 300×250, native, and carefully test popunders (keep density low to avoid high bounce).
- Replace the `.ad-placeholder` contents with the network’s JavaScript zone code.
- Keep “many but manageable”: top banner + one mid-page + optional sidebar is a good starting density.

## Social Sharing Previews

The player share metadata uses only the selected video’s actual thumbnail and title. `js/app.js` updates the Open Graph and Twitter Card image, title, alt text, description, and URL after the video record is loaded; no branded fallback preview card is generated or displayed.

Thumbnail cards now show a shimmer while the image loads, retry one transient network failure, and show a clear unavailable state instead of a broken-image icon. The player uses the provider’s official embed URL, preserves supported embed parameters, retries an iframe network timeout once, and keeps a retry control inside NexusXXX. If the provider itself blocks a specific video from third-party embedding, the site does not bypass that restriction; it retains the in-platform error state and the official provider embed remains the only supported playback source.

The homepage also has a full-catalog sampler backed by `data/pornhub-db-split/feed-index.json`. It samples records from the validated 4,797,027-row corpus and stores displayed IDs in browser storage so returning to the homepage does not merely reshuffle the same curated records. The sampler requires the deployed static host to honor byte-range requests; otherwise it safely falls back to the curated feed rather than downloading whole 75 MB chunks.

Provider-supplied “Watch on Pornhub” links and user-clicked provider popups are not granted navigation permissions inside the embedded player; the player remains contained in NexusXXX. Explicit links outside the player still retain normal redirect behavior. Ad slots are placeholders unless an approved destination is explicitly configured in `js/ad-config.js` or supplied with `data-ad-href`; the code intentionally does not invent advertising URLs.

## Local Development

Just open `index.html` in a browser, or serve the folder:

```bash
npx serve .
# or
python -m http.server 8080
```

## Deploy

1. Buy an adult-friendly domain and hosting (or VPS).
2. Upload the entire folder.
3. Point DNS to your host.
4. Enable HTTPS.
5. Update canonical URLs, Open Graph, and contact details.
6. Submit sitemap to search engines (adult sites face extra scrutiny; focus on long-tail keywords and technical quality).

## SEO Tips Built In

- Keyword-rich titles and meta descriptions
- Category and tag structure for long-tail
- VideoObject JSON-LD on player pages
- Clean URLs and semantic markup
- Fast static assets

## License / Disclaimer

This starter is provided for legitimate adult-business use. You are solely responsible for compliance with all applicable laws (age verification, 2257, DMCA, obscenity, data protection, etc.) in every jurisdiction where you operate or receive traffic. The authors assume no liability.

---
NexusXXX Media starter — August 2026

## Loading and Crash Recovery

The feed renders a responsive skeleton while the first batch is loading and keeps the `Load more` control hidden until a first render completes. Network and catalog failures are presented as an in-page retry card rather than an uncaught asynchronous error.

The player caches the clicked video record in session storage before navigation. Direct or stale video IDs no longer trigger an exhaustive scan across every category chunk, which can exhaust mobile memory; they show a bounded in-page unavailable state instead. A valid player displays a branded loading spinner while the official embed connects and exposes a retry control when the provider or network does not respond.

## Video Navigation Boundary

Video cards, thumbnails, feed previews, and the embedded player surface remain inside NexusXXX. The provider iframe is sandboxed without top-navigation or popup permissions, so a click inside the video cannot redirect the top page or open a provider tab. Internal video cards still navigate to the NexusXXX player route after the site interstitial. Explicit links outside the player, ordinary navigation links, configured ad destinations, and other user-facing anchors retain their normal redirect behavior.

## Loading Performance Strategy

The homepage uses a **progressive first paint**. The bundled local catalog is rendered synchronously when available, so the first video cards do not wait for the latest-feed lookup or the full-catalog sampler. Latest records and genuinely unseen records are hydrated in the background and replace or extend the initial feed only after the first content is already interactive.

The player page declares `preconnect` and `dns-prefetch` hints for the official provider and thumbnail CDN before the iframe is created. This warms DNS, TCP, and TLS connections without proxying media or bypassing provider embed controls. The player continues to use the official provider-issued embed URL inside the navigation-blocking iframe sandbox.

The unseen sampler performs a one-time HTTP byte-range capability probe. If the deployed static host returns `206 Partial Content`, random CSV ranges can be sampled. If it returns `200 OK` with a whole file, the sampler stops immediately and keeps the bundled feed instead of repeating large downloads; this preserves mobile stability while making range support a deployment requirement for the full unseen feed.

The implementation notes and source references are maintained in [`docs/video-loading-research.md`](docs/video-loading-research.md).
