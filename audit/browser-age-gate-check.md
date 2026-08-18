# Browser smoke-test findings

Date: 2026-08-17

- Opening `http://127.0.0.1:8770/index.html` displayed the reference-style age gate with the NexusXXX brand, adult-site notice, `Notice to Users`, legal consent copy, law-enforcement link, enter/exit buttons, parental-controls link, and Terms of Service link.
- Clicking `I am 18 or older - Enter` removed the gate and left the homepage feed usable.
- An internal navigation request to `pages/video.html?id=76890131` returned HTTP 200. The browser capture did not provide a usable screenshot after that navigation, so player-control visual verification remains to be completed with a direct DOM/HTTP check if needed.
- HTTP smoke tests returned 200 for the homepage, player page, Newest page, stylesheet, app script, catalog manifest, and latest-feed manifest.


## Player-page follow-up

A direct browser load of `pages/video.html?id=76890131` showed the age gate hidden and the static `← Previous`, `More videos`, and `Next →` controls present. The dynamic player metadata remained at `Loading…`, so the next validation step is to inspect browser console output and network responses for the catalog lookup rather than treating the static controls as fully initialized.

## Console diagnosis

The browser console showed no JavaScript exception. The player lookup was slow because the tested ID was not found in the initial bootstrap array; `initPlayer()` scanned category chunks, eventually loaded the required Amateur chunk and then successfully loaded `../js/catalog/related.json`. This is an existing resolution-path performance issue rather than a navigation-helper syntax failure, and the next check is to confirm the rendered controls after the lookup completes.

## Idle-timeout simulation

The browser console was used to age `nexusxxx_age_verified_at` by 16 minutes and dispatch a `focus` event. The console tool did not return the object expression, so the visibility result should be confirmed with a direct DOM query before final reporting.

## Confirmed DOM state

The explicit DOM query returned `ageGateClass: "age-gate"`, confirming that the aged verification reopened the gate. It also returned `navLabel: "Amateur · 1 of 213556"`, `prevDisabled: true`, and `nextDisabled: false`, confirming that the player navigation helper initialized a real pool and enabled the forward control at the first position.

## Current revision browser check

The updated direct player page no longer exposes `Previous`, `Next`, or the position label. The age gate still appears when the stored verification is expired; after entering, the gate hides and the player shell remains available. The tested catalog ID can take time to resolve because the runtime searches chunked catalog data, so final checks also use static assertions and HTTP responses.

## Up next verification

After the player finished loading, the DOM query returned `prevNextCount: 0`, `relatedCount: 12`, and Up next categories including `Amateur`, `Babe`, `Big Dick`, and `Big Ass`. This confirms recommendations are no longer restricted to the current channel/category and that the removed player controls are absent.

## Homepage return check

Direct internal return to the homepage produced `ageGateClass: null` before the feed boot completed, indicating the pre-paint rule hid the gate without adding a runtime `hidden` class. The initial DOM query ran before asynchronous feed rendering and therefore saw zero feed items; a later browser wait opened a blank browser view, so feed-scroll behavior is additionally covered by static observer assertions and the existing interstitial click path.
