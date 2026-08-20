# NexusXXX production advertising audit

## Current implementation

The repository currently has seven configurable destination slots in `js/ad-config.js`: `player-top`, `player-mid`, `player-related`, `infeed-banner`, `related-banner`, `sticky-banner`, and `interstitial`. Empty destinations intentionally leave the placeholders inert. `js/app.js` hydrates `[data-ad]` elements with keyboard-accessible click behavior only when a configured `http` or `https` destination exists.

The current hydration is safe as a destination-link fallback, but it is not an ExoClick ad-tag renderer: it does not create ExoClick zone markup, load an ExoClick provider script, or accept an ExoClick zone ID. That should remain a separate opt-in provider adapter rather than treating a provider script as a normal ad destination.

## Official ExoClick findings

ExoClick’s publisher documentation shows that publishers receive provider-specific ad code containing a provider script and a zone identifier. Its banner example uses `https://a.magsrv.com/ad-provider.js` with an `ins` element and a `data-zoneid` value. Its sub-ID documentation also shows popup/popunder code with many network-controlled configuration fields. Therefore the site should not invent zone IDs, inline provider code, popup behavior, or ad-host values. The user must paste the exact approved code/zone values supplied by ExoClick into a local configuration boundary, and the production build must keep provider activation disabled until that configuration is intentionally enabled.

## Initial risk findings

The existing destination hydrator trusts any absolute HTTP(S) destination and opens it in a new tab, with a same-tab fallback. It does not validate against an allowlist, does not provide a visible loading/error state for provider tags, and does not distinguish a normal destination ad from a provider-managed creative. The next implementation should preserve inert empty placeholders, add strict HTTPS/allowed-host validation for configured destinations, provide an explicit opt-in ExoClick banner/native adapter, and avoid injecting popup/popunder code into video-card click handlers or navigation paths.

References:

1. https://docs.exoclick.com/tutorials/tutorials/publishers-tutorials/adding-exoclick-ad-zones-to-apps — ExoClick official publisher tutorial: banner code and zone ID.
2. https://docs.exoclick.com/publishers/sites-and-zones/subids — ExoClick official publisher documentation: zone code and sub-ID configuration.

## Local browser validation

The local Popular route rendered the feed and in-feed ad placeholders after the age gate, and its static page now loads `../js/ad-config.js` before `app.js`. With the default empty configuration, no blank interstitial overlay was shown merely by loading the route; the ad placeholders remained inert and video cards remained usable.

The browser DOM audit confirmed `window.NEXUS_AD_TARGETS` is loaded, all default ad slots are inert, and no interstitial modal exists when no ad is configured. The first inspection saw a stale cached ad-config object without the new ExoClick field; a cache-busting `fetch(..., {cache:'no-store'})` returned HTTP 200 and confirmed the updated `NEXUS_EXOCLICK_CONFIG` with `enabled: false`. Production deploys should use normal cache invalidation or a versioned release when changing ad configuration.
