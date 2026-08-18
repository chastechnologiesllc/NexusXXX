const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "css/styles.css"), "utf8");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

const checks = [
  ["JavaScript contains provider preview fallback", app.includes("mountProviderThumbnailFallback") && app.includes("feed-thumb-provider-preview")],
  ["Fallback uses official embed URL validation", app.includes("embedIframeUrl(item?.dataset.embed || item?.dataset.id || \"\")")],
  ["Fallback iframe keeps top navigation blocked", app.includes("allow-scripts allow-same-origin allow-presentation allow-fullscreen") && !app.includes("allow-top-navigation")],
  ["Visible generic thumbnail error copy removed", !app.includes("Thumbnail unavailable")],
  ["Provider fallback CSS is present", css.includes(".feed-thumb-provider-preview") && css.includes('[data-thumb-state="provider-preview"]')],
  ["Nigeria regional profile is present", app.includes('country: "Nigeria"') && app.includes('Africa/Lagos')],
  ["Regional ranking is homepage-only", app.includes('!isHomePage() || currentQuery || currentFilter !== "all"')],
  ["Precise geolocation is not requested", !app.includes("getCurrentPosition") && !app.includes("ipapi") && !app.includes("ipinfo")],
  ["Homepage provider preconnect is present", read("index.html").includes('rel="preconnect" href="https://www.pornhub.com"')],
  ["Popular and newest provider preconnects are present", read("pages/popular.html").includes('rel="preconnect" href="https://www.pornhub.com"') && read("pages/newest.html").includes('rel="preconnect" href="https://www.pornhub.com"')]
];

const failed = checks.filter(([, ok]) => !ok);
checks.forEach(([name, ok]) => console.log(`${ok ? "PASS" : "FAIL"} ${name}`));
if (failed.length) process.exit(1);
