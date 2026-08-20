# Recommendation and geographic-access audit

## Finding

The NexusXXX application does not contain a country-based video denial branch. The official provider iframe is built from the catalog’s provider embed ID and is not rewritten according to country. The message **“This video isn’t available in your country”** is therefore a provider-side response for a particular video, network, or viewer context, not a NexusXXX recommendation rule.

NexusXXX must not respond to that provider message by filtering the catalog or blocking a country. The site continues to expose the full catalog and internal player route to every visitor. If the provider itself restricts a specific video, the site cannot lawfully or reliably bypass that provider decision; other available videos remain browseable.

## Recommendation behavior

Country is used only as a soft homepage ranking hint based on coarse browser language and timezone signals. It does not filter results, alter the player URL, restrict categories, or affect search, Popular, Newest, category, or related-video access.

The homepage now also records a small anonymous preference profile in localStorage under `nx_interest_signals_v1` when a user opens a video. It stores bounded category and tag scores, not IP addresses, GPS coordinates, account identifiers, or viewing history sent to a server. The unfiltered homepage combines these local click signals with the optional coarse region score; explicit search and category intent always takes precedence.

Related-video clicks pass their actual catalog record into the same signal recorder, so recommendations learn from both feed cards and Up next cards. Scores are capped and trimmed to a bounded number of keys to keep storage and computation small.

## Validation

`tools/validate_recommendations.js` checks that regional scoring is homepage-only, no regional filter or denial branch exists, clicks record categories/tags locally, player navigation remains internal, no local country-denial message is authored, and no GPS/IP lookup is present. The check passed together with the thumbnail validator, SEO validator, JavaScript syntax check, whitespace check, and local HTTP smoke tests.
