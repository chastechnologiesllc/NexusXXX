# Crash and loading validation

The local homepage served successfully and rendered the existing feed records. The Load more wrapper is now hidden in the HTML until JavaScript marks the first feed batch ready. The unknown-video route rendered an in-page `Video unavailable` recovery state with a reload control instead of scanning every category chunk or exposing a browser-level error page. The static page begins with `Preparing video…` and `Loading details…`, and the player retry/share controls are state-aware.

A DOM check on `pages/video.html?id=unknown-test-id` confirmed `iframeCount: 0`, `title: Video unavailable`, and `shareDisabled: true`, proving the page exits cleanly without creating a provider iframe for an unknown record. The local homepage later rendered video cards and the browser-extracted page content showed the feed items, indicating the ready path still works after the skeleton state.
