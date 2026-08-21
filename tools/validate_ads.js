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
const verificationFile = "45438752ac44252e3c2fca9a9c88b4ac.html";
const verificationToken = "45438752ac44252e3c2fca9a9c88b4ac";
const verificationPresent = fs.existsSync(path.join(root, verificationFile)) && read(verificationFile).trim() === verificationToken;

const checks = [
  ["ExoClick root verification token is present", verificationPresent],
  ["ExoClick is intentionally enabled after supplied zone audit", /enabled:\s*true/.test(config)],
  ["all supplied zone IDs are present", ["6008000", "6008004", "6008006", "6008008", "6008010", "6008012"].every(id => config.includes(`"${id}"`))],
  ["both official provider hosts are allowlisted", /https:\/\/a\.magsrv\.com\/ad-provider\.js/.test(config) && /https:\/\/a\.pemsrv\.com\/ad-provider\.js/.test(config) && app.includes("allowedScriptSrcs") && app.includes("loadExoClickScript(config.scriptSrc)")],
  ["all supplied ad slot names exist", ["player-top", "player-mid", "player-related", "infeed-banner", "related-banner", "recommendation", "sticky-banner", "interstitial", "instant-message"].every(name => config.includes(`"${name}"`))],
  ["Popular loads ad configuration", popular.includes("../js/ad-config.js")],
  ["Newest loads ad configuration", newest.includes("../js/ad-config.js")],
  ["player slots are present", ["player-top", "player-mid", "player-related"].every(name => video.includes(`data-ad="${name}"`))],
  ["sticky player slot is present", video.includes('data-ad="sticky-banner"')],
  ["sticky feed slots are present", popular.includes('data-ad="sticky-banner"') && newest.includes('data-ad="sticky-banner"')],
  ["native recommendation feed slots are present", popular.includes('data-ad="recommendation"') && newest.includes('data-ad="recommendation"')],
  ["push worker is installed at root", fs.existsSync(path.join(root, "worker.js")) && read("worker.js").includes("js.wpnsrv.com/worker.php")],
  ["push configuration is present", /pn_idzone/.test(app) && /6008016/.test(config)],
  ["VAST endpoint is configured", /https:\/\/s\.magsrv\.com\/v1\/vast\.php\?id=6008018/.test(config) && /"vast"/.test(config)],
  ["watch pages are generated", watchPages.length > 0],
  ["watch pages have all player ad slots", ["player-top", "player-mid", "player-related"].every(name => sampleWatch.includes(`data-ad="${name}"`))],
  ["watch pages have sticky slot", sampleWatch.includes('data-ad="sticky-banner"')],
  ["watch pages load ad configuration", sampleWatch.includes("../../js/ad-config.js")],
  ["destination validation requires HTTPS in production", app.includes('parsed.protocol !== "https:"')],
  ["provider output is contained", css.includes("ad-provider-host") && css.includes("overflow: hidden")],
  ["blank interstitial is bypassed", app.includes("if (!configuredDestination && !hasProviderInterstitial)") && app.includes("onContinue();")],
  ["popup/top-navigation permissions are not added to video embeds", !app.includes("allow-top-navigation") && !app.includes("allow-popups")],
  ["VAST is not injected into the sandboxed provider iframe", !app.includes("allow-popups") && !app.includes("allow-top-navigation") && !app.includes("vastIframe")],
];
const failures = checks.filter(([, ok]) => !ok).map(([name]) => name);
const report = { valid: failures.length === 0, checks: checks.length, watchPages: watchPages.length, failures };
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
