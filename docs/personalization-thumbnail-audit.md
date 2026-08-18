# Thumbnail recovery and country-aware personalization

## Executive summary

NexusXXX now treats a failed CDN thumbnail as a **provider-preview recovery case**, not as a reason to show the generic “Thumbnail unavailable” message. After one cache-busting retry, the card mounts the selected video’s official embed URL inside a lazy, sandboxed iframe. This lets the provider render its own poster/player view for that specific video without proxying media or redirecting the top-level page.

The homepage also applies a **coarse local regional hint**. It uses the browser’s preferred language-region tags and IANA timezone, keeps the result in memory for the current page, and never requests GPS permission or sends the user’s IP to a third-party geolocation service. The hint only changes homepage ranking; search, category, popular, newest, and player-related views retain their existing intent.

## Findings and implementation

| Area | Finding | Implementation |
|---|---|---|
| Failed thumbnails | The old path retried once and then displayed visible “Thumbnail unavailable” text. | Retry once, then mount the video’s official embed preview for the failed card. The visible generic error copy was removed. |
| Provider boundary | Provider embeds are the supported source for playback and preview content [3]. | Use the existing validated `embedIframeUrl()` path and the same navigation-blocking sandbox policy used elsewhere. |
| Browser language | `navigator.languages` returns preferred BCP 47 language tags in priority order, but browsers may reduce the list for privacy [1]. | Extract only a two-letter region code when present; treat it as a hint, not proof of country. |
| Browser timezone | `Intl.DateTimeFormat().resolvedOptions().timeZone` returns the runtime’s IANA timezone [2]. | Prefer a recognized timezone over a conflicting language-region code because it is a useful coarse regional signal, while still remaining user-configurable. |
| Precise location | `getCurrentPosition()` requires HTTPS and explicit permission and may prompt the user [4]. | Do not request precise geolocation for silent content personalization. |
| Ranking scope | Personalization can make search and category intent less predictable. | Apply regional scoring only on the unfiltered homepage feed and display a small “Suggested for …” note when a hint is available. |
| Mobile cost | Loading every regional or provider resource at once would be expensive. | The provider fallback is created only after a card’s own image fails; the ranking is synchronous and network-free. |

## Regional profiles

The current profile map contains country and timezone hints for a broad set of locales including Nigeria, Ghana, Kenya, South Africa, Brazil, Mexico, India, Japan, South Korea, the United Kingdom, France, Germany, Italy, Russia, the United States, Canada, Australia, Spain, Colombia, Argentina, the Philippines, Thailand, China, Turkey, Poland, and Ukraine. Each profile maps to terms already present in the catalog’s title, category, or tag metadata. For example, the Nigeria profile gives additional weight to Nigerian/African terms and the existing Black/Ebony metadata. It does not claim that a video’s performers, uploader, or audience are actually from that country.

A user with no recognized language-region or timezone hint receives the ordinary global homepage ranking. VPNs, privacy tools, browser settings, travel, and shared devices can make browser hints differ from physical location, so the feature is intentionally approximate and non-blocking.

## Thumbnail recovery behavior

Each feed and related card keeps its own video ID and official embed URL. The first image failure triggers one cache-busting retry. If the retry fails, the image is hidden and a lazy iframe is inserted with `autoplay=0&preload=metadata`. The iframe uses `allow-scripts allow-same-origin allow-presentation allow-fullscreen` and does not grant top-navigation or popup permissions. If the provider preview itself cannot render, the card retains its title, duration, play affordance, and in-platform navigation rather than displaying a misleading generic thumbnail message.

The homepage, Popular page, and Newest page now preconnect to the provider and thumbnail CDN. This makes the per-card fallback less likely to wait on a cold connection while leaving ordinary site navigation unchanged.

## References

[1]: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/languages "MDN: Navigator.languages"

[2]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/resolvedOptions "MDN: Intl.DateTimeFormat.prototype.resolvedOptions()"

[3]: https://www.pornhub.com/webmasters "Pornhub Webmasters: embed and provider-controlled video resources"

[4]: https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition "MDN: Geolocation.getCurrentPosition()"
