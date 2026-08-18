# NexusXXX Video Loading Research

## Executive summary

The main delay observed in NexusXXX was the feed’s page-level boot sequence, not a custom media pipeline. The homepage previously kept the first render behind a latest-feed lookup and a full-catalog byte-range sampler. The optimized flow now paints the bundled catalog synchronously, then hydrates latest and unseen records in the background. The player page also warms the provider and thumbnail-CDN connections before creating the official embed iframe.

NexusXXX continues to use the provider-issued embed URL and does not proxy, download, or recreate the underlying media stream. Pornhub’s official support page says that its videos may be embedded and directs publishers to its webmaster embed exports and the per-video Share > Embed workflow [1].

## Findings and implemented responses

| Finding | Implemented response | Expected effect |
|---|---|---|
| The homepage could wait on asynchronous catalog work before showing cards. | Render the bundled `js/data.js` records immediately when no category or search query is active; run latest/unseen hydration afterward. | First content and card clicks no longer depend on network catalog requests. |
| A provider iframe still needs DNS, TCP, and TLS setup before it can load. | Add `preconnect` and `dns-prefetch` hints for `www.pornhub.com` and `ei.phncdn.com` in `pages/video.html`. | The browser can begin the critical cross-origin handshake earlier. |
| A static host may ignore the `Range` header and return an entire CSV file. | Probe one representative part once; continue sampling only after a `206 Partial Content` response. | Unsupported hosts fail fast and avoid repeated multi-megabyte downloads. |
| Direct player navigation can lack the catalog record. | Resolve the clicked record from session storage or bundled data and avoid exhaustive category scans. | Valid clicks render promptly; stale or direct IDs show a bounded unavailable state instead of risking a memory-heavy scan. |
| The iframe must remain inside NexusXXX. | Keep the official iframe in the existing sandbox without top-navigation or popup permissions. | Provider content remains contained while ordinary site links and configured ads keep their normal behavior. |

## Official provider and browser guidance

The official provider guidance supports using embed codes and webmaster exports rather than attempting to host or extract video files [1] [2]. The NexusXXX implementation therefore preserves the official `https://www.pornhub.com/embed/<id>` URL and uses the export’s thumbnail and metadata fields.

The `preconnect` hint is a browser performance hint for a critical cross-origin origin. MDN describes it as allowing the browser to preemptively perform some or all of the DNS, TCP, and TLS handshake, while warning that preconnecting to too many third-party origins can be counterproductive [3]. NexusXXX limits the hints to the provider origin and the thumbnail CDN used by the player page.

HTTP range requests are suitable for sampling a small portion of a large resource. A successful partial response uses status `206 Partial Content`; when a server does not support partial requests it may return `200 OK` with the entire response body [4]. The sampler now treats `206` as the required capability and treats other responses as an intentional fallback to the bundled feed.

## Local validation, 18 August 2026

The local server was started on port `8083`. On `http://127.0.0.1:8083/index.html`, the initial post-age-gate page exposed the bundled video cards and their CDN thumbnail URLs without waiting for the full-catalog sampler. The local environment also displayed the configured interstitial-ad overlay; that overlay is unrelated to feed boot and is not used as a player timing signal.

A direct navigation to `pages/video.html?id=ph5a7f1ba584481` resolved the bundled record immediately. The document title reflected the selected video, and the page did not enter the unavailable-record path. The final provider iframe playback time remains dependent on the external embed service and should be measured again on the deployed site.

The local Python static server returned `200 OK` and the full `74,998,575`-byte CSV file for a request asking for bytes `0-0`. This confirms that the local server does not support the sampler’s required range behavior. The new one-time probe therefore disables repeated range sampling on that host and preserves the bundled feed, which is the intended safe fallback.

## Deployment verification

After deployment, verify the first byte-range capability with a small header/body request against one committed CSV part. A working host should return `206 Partial Content` and a small body. A `200 OK` response means that the sampler will intentionally retain the bundled feed until the host’s range support or the feed-delivery architecture is changed.

```bash
curl -sS -D - -o /tmp/nexus-range-test.bin \
  --range 128-65663 \
  https://arfait-e67215.netlify.app/data/pornhub-db-split/categories/brunette/part-0001.csv
wc -c /tmp/nexus-range-test.bin
```

Also verify that the deployed `pages/video.html` contains the two `preconnect` hints, that the first homepage batch is visible before catalog hydration completes, and that a clicked card reaches `/pages/video.html?id=<id>` without changing the top-level origin.

## References

[1]: https://help.pornhub.com/hc/en-us/articles/4419891126931-Can-I-embed-Pornhub-videos-on-my-site-for-free "Pornhub Help: Can I embed Pornhub videos on my site for free?"

[2]: https://www.pornhub.com/webmasters "Pornhub Webmasters: Embed Videos and Embed Dump"

[3]: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/preconnect "MDN: rel=preconnect"

[4]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Range_requests "MDN: HTTP range requests"
