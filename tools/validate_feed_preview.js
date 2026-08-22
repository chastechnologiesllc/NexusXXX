#!/usr/bin/env node
const fs = require("fs");
const app = fs.readFileSync("js/app.js", "utf8");
const css = fs.readFileSync("css/styles.css", "utf8");
const checks = [
  ["IntersectionObserver is used", app.includes("new IntersectionObserver")],
  ["meaningful visibility threshold", app.includes("intersectionRatio < 0.55")],
  ["one active preview at a time", app.includes("stopAllPreviews();") && app.includes("activePreviewId")],
  ["muted autoplay requested", app.includes("autoplay=1&muted=1&preload=metadata")],
  ["official embed URL sanitizer used", app.includes("embedIframeUrl(item.dataset.embed || item.dataset.id || \"\")")],
  ["top navigation remains blocked", app.includes("sandbox",) && app.includes("allow-scripts allow-same-origin allow-presentation allow-fullscreen") && !app.includes("allow-top-navigation")],
  ["preview does not replace provider-thumbnail fallback", app.includes('thumb.dataset.providerFallback === "1"')],
  ["page-hidden previews stop", app.includes("if (document.hidden) return false")],
  ["reduced-motion previews stop", app.includes("prefers-reduced-motion: reduce")],
  ["data saver previews stop", app.includes("navigator.connection?.saveData")],
  ["invalid video-file thumbnails are filtered", app.includes("isUsableThumbnailUrl") && app.includes("socialPreviewImages(video)") && app.includes("filter(isUsableThumbnailUrl)")],
  ["static watch records boot the player", app.includes("window.__NEXUS_STATIC_VIDEO") && app.includes("staticVideo")],
  ["static watch navigation remains internal", app.includes("videoPageUrl(video.id, video)") && app.includes("watchUrl")],
  ["poster remains until iframe ready", css.includes(".feed-thumb.previewing img { opacity: 1; }") && css.includes("previewing.preview-ready img")],
  ["iframe fades in only when ready", css.includes(".feed-thumb.previewing.preview-ready .feed-preview { opacity: 1; }")],
  ["preview loading indicator exists", css.includes("feed-thumb.previewing:not(.preview-ready)::after")],
  ["share URL is in player scope", app.includes('const shareUrl = video.watchUrl') && app.indexOf('const shareUrl = video.watchUrl') < app.indexOf('(function setShareMeta()')],
  ["copy handler uses share URL", app.includes('navigator.clipboard.writeText(shareUrl)') && app.includes('prompt("Copy:", shareUrl)')],
  ["native share uses one URL", app.includes('const shareData = { title: video.title, url: shareUrl }') && app.includes('navigator.share(shareData)')],
  ["runtime metadata uses play-overlay image URL", app.includes('crawlerPreviewImageUrl') && app.includes('preview-image?url=') && app.includes('&v=play4')],
  ["runtime metadata declares PNG dimensions", app.includes('socialPreviewType(img)') && app.includes('img ? "640" : ""') && app.includes('img ? "480" : ""')],
  ["direct locator player lookup exists", app.includes('fetchCatalogJson(catalogFile)') && app.includes('LEGACY_VIDEO_LOCATORS')],
  ["watch-page up-next route climbs to player page", app.includes('location.pathname.includes("/pages/watch/")') && app.includes('?" + params.toString()')],
  ["load more opens interstitial", app.includes('showInterstitial(() => loadMoreFeed())') && app.includes('showInterstitial(() => loadMoreRelated())')],
  ["Up next anchors use internal player routes", app.includes('class="related-item" href="${escapeHtml(videoPageUrl(v.id, v, { preferStatic: false }))}"') && app.includes('e.preventDefault();') && app.includes('openVideo(a.dataset.id, relatedVideo)')],
  ["player initialization failures render recoverable UI", app.includes('[NexusXXX] player initialization failed') && app.includes('renderPlayerUnavailable("The player could not load this video. Please try again.")')],
  ["related pagination failures render recoverable UI", app.includes('[NexusXXX] related pagination failed') && app.includes('class="related-load-error"') && app.includes('More videos could not load right now')],
  ["load more preserves loading cleanup", app.includes('async function loadMoreFeed()') && app.includes('button.classList.remove("is-loading")')],
  ["sticky clearance is measured", app.includes('syncStickyAdClearance') && app.includes('ResizeObserver(syncStickyAdClearance)')],
  ["pagination clears sticky ad", css.includes('var(--nx-sticky-clearance') && css.includes('scroll-margin-bottom')],
  ["Popular has an explicit view floor", app.includes('MIN_POPULAR_VIEWS = 1000') && app.includes('Number(v.views) >= MIN_POPULAR_VIEWS')],
  ["Popular is sorted by views without shuffle", app.includes('if (isPopularPage())') && app.includes('(Number(b.views) || 0) - (Number(a.views) || 0)')],
  ["Newest excludes unseen sampler", app.includes('isNewestPage()) list = all.filter(v => String(v.category || "").toLowerCase() === "newest")')],
  ["age-gate promotes ready feed/player", app.includes('requestAnimationFrame') && app.includes('if (feed && !feed.children.length') && app.includes('!document.querySelector("#player-iframe iframe")')],
  ["dynamic feed ads are hydrated", app.includes('hydrateAdSlots(feed)') && app.includes('el.dataset.ad = "infeed-banner"')],
  ["dynamic related ads are hydrated", app.includes('hydrateAdSlots(related)') && app.includes('data-ad="related-banner" data-ad-state="pending"')],
  ["ad placeholders are hidden until ready", css.includes('[data-ad]:not([data-ad-state="provider"]):not([data-ad-state="link"])') && css.includes('data-ad-state="error"')],
  ["Up next renders before background hydration", app.includes('renderRelated(true);') && app.includes('window.__relatedIndexPromise = loadRelatedIndex()') && app.includes('window.__relatedCategoryPromise = loadCategory(video.category)')],
  ["related pagination awaits background hydration", app.includes('if (window.__relatedIndexPromise) await window.__relatedIndexPromise') && app.includes('if (window.__relatedCategoryPromise) await window.__relatedCategoryPromise')],
  ["interstitial continuation catches async errors", app.includes('Promise.resolve(continueAction()).catch')],
];
const failures = checks.filter(([, ok]) => !ok).map(([name]) => name);
const report = { valid: failures.length === 0, checks: checks.length, failures };
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
