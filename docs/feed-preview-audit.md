
## Browser guidance

The existing implementation already uses `IntersectionObserver` to choose a visible card and mounts an official provider iframe with `autoplay=1&muted=1`. MDN documents that Intersection Observer is designed for visibility-triggered lazy work and that threshold/rootMargin control when a target is considered visible [1]. MDN’s autoplay guidance recommends muted autoplay and handling `play()` rejection or browser/provider blocking as a normal fallback path [2]. Chrome likewise documents that muted autoplay is generally permitted while autoplay with sound is restricted [3].

Implementation implication: keep one active preview at a time, start only after a meaningful visibility threshold, stop promptly when the card leaves the viewport, preserve the thumbnail until the preview iframe is ready, and provide an explicit “Play preview” affordance if provider autoplay is blocked. The preview must remain a sandboxed official embed and never receive top-navigation or popup permissions.

[1]: https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API "MDN: Intersection Observer API"
[2]: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay "MDN: Autoplay guide for media and Web Audio APIs"
[3]: https://developer.chrome.com/blog/autoplay "Chrome Developers: Autoplay policy in Chrome"

## Implementation record

The feed preview controller now ranks visible cards by intersection ratio and distance from the viewport center, starts only one muted official embed at a time, and tears it down when no card remains above the visibility threshold. The thumbnail remains visible while the provider iframe connects and fades to the preview only after the iframe load event. Preview start is skipped for cards already using the per-video thumbnail-recovery iframe.

Autoplay is disabled when the document is hidden, the user prefers reduced motion, or the browser exposes `navigator.connection.saveData`. The iframe remains sandboxed without top-navigation or popup permissions, and the existing click handler continues to open the internal NexusXXX player route rather than the provider page.

## Local browser smoke test

The updated local homepage rendered the real feed cards and existing Load more state after the age gate. The existing scroll interstitial also appeared while navigating the feed; it is an independent ad overlay and must be dismissed before visually checking a card preview. The browser content confirmed that preview cards expose their real thumbnails, titles, durations, and feed metadata.

The local DOM smoke test found 12 feed cards, exactly one `.feed-preview` iframe, and exactly one `.feed-thumb.previewing` card. Its source was the sanitized official embed with `autoplay=1&muted=1&preload=metadata`, and its sandbox remained `allow-scripts allow-same-origin allow-presentation allow-fullscreen`. The provider iframe had not yet emitted its load event in the sandbox, so the thumbnail remained visible until readiness as designed.

A simulated local scroll reached `scrollY=1002`, the end of the loaded document. The DOM still contained one active preview because the current viewport remained within the loaded feed’s last visible card region; no additional preview was created. The deterministic controller continues to enforce one active iframe at a time. The browser sandbox did not provide a reliable full-layout scroll sequence for a separate out-of-view card, so teardown is additionally covered by the visibility-state logic and deterministic source checks.
