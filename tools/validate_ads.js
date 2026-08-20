#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const config = read("js/ad-config.js");
const app = read("js/app.js");
const css = read("css/styles.css");
const popular = read("pages/popular.html");
const newest = read("pages/newest.html");
const video = read("pages/video.html");
const watchDir = path.join(root, "pages/watch");
const watchPages = fs.existsSync(watchDir)
  ? fs.readdirSync(watchDir).filter(name => name.endsWith(".html"))
  : [];
const sampleWatch = watchPages.length ? read(path.join("pages/watch", watchPages[0])) : "";

const checks = [
  ["default ExoClick is disabled", /enabled:\s*false/.test(config)],
  ["default ExoClick zone IDs are empty", /zoneId:\s*""/.test(config)],
  ["official ExoClick provider host is fixed", /https:\/\/a\.magsrv\.com\/ad-provider\.js/.test(config) && /a\.magsrv\.com\/ad-provider\.js/.test(app)],
  ["all seven ad slot names exist", ["player-top", "player-mid", "player-related", "infeed-banner", "related-banner", "sticky-banner", "interstitial"].every(name => config.includes(`"${name}"`))],
  ["Popular loads ad configuration", popular.includes("../js/ad-config.js")],
  ["Newest loads ad configuration", newest.includes("../js/ad-config.js")],
  ["player slots are present", ["player-top", "player-mid", "player-related"].every(name => video.includes(`data-ad="${name}"`))],
  ["sticky player slot is present", video.includes('data-ad="sticky-banner"')],
  ["sticky feed slots are present", popular.includes('data-ad="sticky-banner"') && newest.includes('data-ad="sticky-banner"')],
  ["watch pages are generated", watchPages.length > 0],
  ["watch pages have all player ad slots", ["player-top", "player-mid", "player-related"].every(name => sampleWatch.includes(`data-ad="${name}"`))],
  ["watch pages have sticky slot", sampleWatch.includes('data-ad="sticky-banner"')],
  ["watch pages load ad configuration", sampleWatch.includes("../../js/ad-config.js")],
  ["destination validation requires HTTPS in production", app.includes('parsed.protocol !== "https:"')],
  ["provider output is contained", css.includes("ad-provider-host") && css.includes("overflow: hidden")],
  ["blank interstitial is bypassed", app.includes("if (!configuredDestination && !hasProviderInterstitial)") && app.includes("onContinue();")],
  ["popup/top-navigation permissions are not added to video embeds", !app.includes("allow-top-navigation") && !app.includes("allow-popups")],
  ["no ExoClick zone ID is committed", !/zoneId:\s*"\d+"/.test(config)],
];
const failures = checks.filter(([, ok]) => !ok).map(([name]) => name);
const report = { valid: failures.length === 0, checks: checks.length, watchPages: watchPages.length, failures };
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
