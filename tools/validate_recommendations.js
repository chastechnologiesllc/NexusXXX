#!/usr/bin/env node
const fs = require("fs");
const app = fs.readFileSync("js/app.js", "utf8");

const regionalBody = app.match(/function regionalScore\(video\) \{[\s\S]*?\n  \}\n\n  const INTEREST_KEY/)?.[0] || "";
const checks = [
  ["regional score is homepage-only", /isHomePage\(\)/.test(regionalBody) && /currentQuery/.test(regionalBody) && /currentFilter/.test(regionalBody)],
  ["regional score never filters the list", !/return\s+\[\]/.test(regionalBody)],
  ["click interests use localStorage", /const INTEREST_KEY = "nx_interest_signals_v1"/.test(app) && /localStorage\.setItem\(INTEREST_KEY/.test(app)],
  ["clicks record category and tags", /add\(categories, video\.category, 3\)/.test(app) && /video\.tags/.test(app)],
  ["openVideo records clicked video interest", /function openVideo\(id, video = null\)[\s\S]{0,180}recordInterest\(video\)/.test(app)],
  ["homepage combines soft signals only", /const scoreA = regionalScore\(a\) \+ interestScore\(a\)/.test(app)],
  ["search and category intent are preserved", /currentQuery \|\| currentFilter !== "all"/.test(app)],
  ["provider URL validation has no country branch", /function embedIframeUrl[\s\S]{0,700}pornhub\\.com/.test(app) && !/country.*(block|deny|restrict)/i.test(app)],
  ["internal video route remains the only card route", app.includes("function videoPageUrl") && app.includes("video.html?") && app.includes("params.set(\"catalog\", catalogFile)") && !/openVideo[\s\S]{0,240}pornhub\.com\/view_video/i.test(app)],
  ["no geographic denial message is authored locally", !/isn't available in your country|not available in your country|unavailable in your country/i.test(app)],
  ["privacy boundary has no GPS or IP lookup", !/navigator\.geolocation|ipapi|ipinfo|ipwho|geolocation/i.test(app)],
];
const failures = checks.filter(([, ok]) => !ok).map(([name]) => name);
const report = { valid: failures.length === 0, checks: checks.length, failures };
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
