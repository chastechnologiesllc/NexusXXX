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
  ["poster remains until iframe ready", css.includes(".feed-thumb.previewing img { opacity: 1; }") && css.includes("previewing.preview-ready img")],
  ["iframe fades in only when ready", css.includes(".feed-thumb.previewing.preview-ready .feed-preview { opacity: 1; }")],
  ["preview loading indicator exists", css.includes("feed-thumb.previewing:not(.preview-ready)::after")],
];
const failures = checks.filter(([, ok]) => !ok).map(([name]) => name);
const report = { valid: failures.length === 0, checks: checks.length, failures };
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
