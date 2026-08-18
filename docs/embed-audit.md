# Embed and thumbnail audit findings

## Official provider guidance

The official Pornhub Help article at https://help.pornhub.com/hc/en-us/articles/4419891126931-Can-I-embed-Pornhub-videos-on-my-site-for-free states that videos can be embedded on third-party sites and that publishers should use the embed option from the provider or the official Webmaster embed exports. It does not document a supported alternative player for a video that explicitly displays an embed restriction.

## Current repository findings

The feed cards currently render thumbnail URLs directly with a lazy-loaded `<img>` and an inline error handler that replaces a failed image with a plain dark SVG. Related-video cards render direct `<img>` elements without a load/error handler, which explains the broken-image state visible in the supplied screenshot.

The player constructs a provider iframe using the official `/embed/<id>` URL and a sandbox. A blocked embed can show the provider's own restriction message; the repository must not bypass that restriction by scraping or proxying the video. The compliant fallback is to keep the user on the NexusXXX page, preserve the thumbnail/title, show a clear unavailable state, and offer an optional provider link only if the user chooses it.

The current player retry/eager-loading changes are already present. The next implementation should add reusable shimmer/error thumbnail handling and explicit blocked-embed state detection without attempting to defeat provider controls.

## Local browser verification

The local homepage rendered the feed records and related video content from the existing catalog. The local player route rendered the selected video title, metadata, official embed page container, and related cards. The age gate remained active during verification, so the provider iframe was not interacted with in the sandbox browser. Static syntax and diff checks passed separately.
