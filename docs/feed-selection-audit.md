# Feed selection and navigation audit

## Findings

The repository currently has a curated `js/data.js` feed of approximately 40 records, while the validated source package contains 4,797,027 records in 341 categorized CSV chunks across 119 categories. The existing feed logic sorts and session-shuffles the curated in-memory list, which explains why users see the same videos in a different order.

A compact `data/pornhub-db-split/feed-index.json` was generated from the validated manifest. It describes all 341 chunks and all 4,797,027 source rows without duplicating the source data.

A browser-side sampler was designed to request small byte ranges from random chunk positions, but the local Python static server returned HTTP 200 and the full 74,998,575-byte chunk for a Range request rather than HTTP 206. Therefore the production deployment must be verified to support partial content before relying on this path; the sampler must retain a curated fallback when Range is unavailable rather than downloading a full chunk into browser memory.

Netlify's official caching documentation states that static assets are cached at the CDN edge and invalidated on deploy, but it does not explicitly document a byte-range guarantee in the page reviewed. The production deployment should therefore be tested directly or the large-catalog sampling should be moved behind a server/edge endpoint that performs bounded reads.

## Navigation and ads

The official provider iframe currently used a sandbox without user-activated top navigation or popup permissions, which can block a provider-supplied “Watch on Pornhub” link even when the user clicks it. The player policy was changed to allow user-activated top navigation and popups while still blocking automatic navigation. The repository has no configured ad destinations; its ad slots are placeholders. A safe configurable ad-target layer was added without inventing third-party destinations.

## Live deployment check

The current Netlify URL `https://arfait-e67215.netlify.app` returned HTTP 404 for both `data/pornhub-db-split/feed-index.json` and a representative CSV chunk during this audit, because the current commit had not yet deployed those new assets. After the commit is deployed, the live index must return HTTP 200 and the live chunk endpoint should be tested for HTTP 206 before treating the full-catalog sampler as active.
