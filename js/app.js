/**
 * NexusXXX — Hardened category matching + search + related + ads
 * Fix: load catalog JSON BEFORE filter; strict category match; better related
 */
(function () {
  "use strict";

  function catalogBase() {
    // Works on Netlify root and /pages/*
    const path = window.location.pathname || "";
    if (path.includes("/pages/")) return "../js/catalog/";
    return "/js/catalog/"; // absolute from site root — more reliable on Netlify
  }

  const PAGE_SIZE = 12;
  const AD_EVERY = 3;
  function socialPreviewImage(video) {
    return String(video?.thumb || "").trim();
  }

  function socialPreviewType(imageUrl) {
    return /\.png(?:[/?#]|$)/i.test(imageUrl) ? "image/png" : "image/jpeg";
  }

  const loadedCategories = new Set();
  const loadPromises = {}; // prevent duplicate fetches
  const categoryStates = {}; // { canonical: { files, next, total, loaded } }
  let catalogIndexPromise = null;
  let searchIndexPromise = null;
  let relatedIndexPromise = null;
  let latestIndexPromise = null;
  let latestLoaded = false;
  let visibleCount = PAGE_SIZE;
  let currentFilter = "all";
  let currentSort = "popular";
  let currentQuery = "";
  let videoClickCount = parseInt(sessionStorage.getItem("nx_clicks") || "0", 10) || 0;
  let activePreviewId = null;
  let previewObserver = null;
  let feedInterstitialObserver = null;
  let feedScrollInterstitialShown = sessionStorage.getItem("nx_feed_scroll_interstitial_shown") === "1";
  let isFiltering = false;
  let feedReady = false;
  let feedIndexPromise = null;
  let unseenFeedVideos = [];
  const SEEN_VIDEO_KEY = "nx_seen_video_ids_v1";
  const SEEN_VIDEO_MAX = 20000;

  const CANONICAL = {
    "Amateur":"amateur","Big Ass":"big-ass","Asian":"asian","Babe":"babe",
    "Big Dick":"big-dick","Big Tits":"big-tits","Brunette":"brunette","Blonde":"blonde",
    "Blowjob":"blowjob","Fetish":"fetish","Hardcore":"hardcore","Ebony":"ebony",
    "Pornstar":"pornstar","MILF":"milf","Cumshot":"cumshot","Lesbian":"lesbian",
    "BBW":"bbw","Anal":"anal","Japanese":"japanese","Teen":"teen","Orgy":"orgy",
    "Creampie":"creampie","Toys":"toys","Bondage":"bondage","Latina":"latina",
    "Masturbation":"masturbation","Bareback":"bareback","Public":"public","POV":"pov",
    "Exclusive":"exclusive","Transgender":"transgender","Euro":"euro","Black":"black",
    "Daddy":"daddy","Verified Amateurs":"verified-amateurs","Handjob":"handjob",
    "Mature":"mature","Muscle":"muscle","Interracial":"interracial","Hentai":"hentai",
    "Massage":"massage","Threesome":"threesome","Solo Male":"solo-male","Squirt":"squirt",
    "Reality":"reality","Cartoon":"cartoon","Rough Sex":"rough-sex","College":"college",
    "Compilation":"compilation","Role Play":"role-play","Feet":"feet","Bukkake":"bukkake",
    "Redhead":"redhead","Small Tits":"small-tits","Webcam":"webcam","Solo Female":"solo-female",
    "Gangbang":"gangbang","Vintage":"vintage","Casting":"casting",
    "Double Penetration":"double-penetration","Latino":"latino","Newest":"newest"
  };

  const ALIASES = {
    "masturbating":["Masturbation"],"masturbate":["Masturbation"],"solo":["Masturbation","Solo Female","Solo Male"],
    "squirting":["Squirt"],"squirt":["Squirt"],
    "fingering":["Masturbation","Lesbian","Solo Female"],"finger":["Masturbation","Lesbian"],
    "big dick":["Big Dick"],"bigdick":["Big Dick"],"big cock":["Big Dick"],"bbc":["Big Dick","Interracial","Ebony"],
    "pawg":["Big Ass"],"booty":["Big Ass"],"big ass":["Big Ass"],"bigass":["Big Ass"],
    "tits":["Big Tits"],"boobs":["Big Tits"],"big tits":["Big Tits"],
    "blow job":["Blowjob"],"blowjob":["Blowjob"],"bj":["Blowjob"],
    "cum shot":["Cumshot"],"cumshot":["Cumshot"],"creampie":["Creampie"],
    "anal":["Anal"],"threesome":["Threesome"],"gangbang":["Gangbang","Orgy"],"orgy":["Orgy","Gangbang"],
    "lesbian":["Lesbian"],"milf":["MILF","Mature"],"mature":["Mature","MILF"],"teen":["Teen"],
    "amateur":["Amateur","Verified Amateurs"],"asian":["Asian","Japanese"],"japanese":["Japanese","Asian"],
    "ebony":["Ebony","Black"],"black":["Black","Ebony"],"latina":["Latina","Latino"],"latino":["Latino","Latina"],
    "blonde":["Blonde"],"brunette":["Brunette"],"redhead":["Redhead"],
    "bondage":["Bondage","Fetish"],"bdsm":["Bondage","Fetish"],"fetish":["Fetish","Bondage"],
    "pov":["POV"],"public":["Public"],"handjob":["Handjob"],"massage":["Massage"],
    "hentai":["Hentai","Cartoon"],"cartoon":["Cartoon","Hentai"],"webcam":["Webcam"],
    "college":["College","Teen"],"rough":["Rough Sex","Hardcore"],"hardcore":["Hardcore","Rough Sex"],
    "babe":["Babe"],"pornstar":["Pornstar"],"trans":["Transgender"],"transgender":["Transgender"],
    "feet":["Feet"],"bukkake":["Bukkake"],"double penetration":["Double Penetration"],"dp":["Double Penetration"],
    "rough sex":["Rough Sex"],"latest":["Newest"],"new videos":["Newest"],"newest":["Newest"]
  };

  function normalizeCat(name) {
    if (!name) return "";
    if (CANONICAL[name]) return name;
    const lower = String(name).toLowerCase().trim();
    for (const key of Object.keys(CANONICAL)) {
      if (key.toLowerCase() === lower) return key;
    }
    // try CATALOG_INDEX reverse
    if (typeof CATALOG_INDEX !== "undefined") {
      for (const [k, slug] of Object.entries(CATALOG_INDEX)) {
        if (k.toLowerCase() === lower || slug === lower) return k;
      }
    }
    return name;
  }

  function resolveSlug(categoryName) {
    const canonical = normalizeCat(categoryName);
    if (typeof CATALOG_INDEX !== "undefined" && CATALOG_INDEX[canonical]) {
      return CATALOG_INDEX[canonical];
    }
    if (CANONICAL[canonical]) return CANONICAL[canonical];
    return String(canonical).toLowerCase().replace(/\s+/g, "-").replace(/\//g, "-");
  }

  // ---------- Age confirmation / site lifecycle ----------
  const ageGate = document.getElementById("age-gate");
  const AGE_VERIFIED_KEY = "nexusxxx_age_verified_at";
  const AGE_IDLE_MS = 15 * 60 * 1000;
  let lastHiddenAt = 0;
  let ageRecheckTimer = null;

  function ageVerifiedFresh() {
    const verifiedAt = Number(localStorage.getItem(AGE_VERIFIED_KEY) || "0");
    return verifiedAt > 0 && Date.now() - verifiedAt < AGE_IDLE_MS;
  }
  function showAgeGate(reason) {
    if (!ageGate) return;
    ageGate.classList.remove("hidden");
    document.body.classList.add("age-gate-open");
    ageGate.dataset.reason = reason || "entry";
    document.getElementById("age-enter")?.focus({ preventScroll: true });
  }
  function hideAgeGate() {
    if (!ageGate) return;
    ageGate.classList.add("hidden");
    document.body.classList.remove("age-gate-open");
  }
  function recheckAgeGate(reason) {
    if (ageVerifiedFresh()) hideAgeGate();
    else showAgeGate(reason || "return");
  }
  if (ageVerifiedFresh()) hideAgeGate();
  else showAgeGate("entry");
  document.getElementById("age-enter")?.addEventListener("click", () => {
    localStorage.setItem(AGE_VERIFIED_KEY, String(Date.now()));
    hideAgeGate();
  });
  document.getElementById("age-exit")?.addEventListener("click", () => {
    localStorage.removeItem(AGE_VERIFIED_KEY);
    location.replace("https://www.google.com");
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) lastHiddenAt = Date.now();
    else if (lastHiddenAt && Date.now() - lastHiddenAt >= AGE_IDLE_MS) recheckAgeGate("return-after-idle");
  });
  window.addEventListener("pageshow", () => recheckAgeGate("entry-or-return"));
  window.addEventListener("focus", () => recheckAgeGate("focus-return"));
  ageRecheckTimer = window.setInterval(() => {
    if (!document.hidden && !ageVerifiedFresh()) showAgeGate("idle-timeout");
  }, 30 * 1000);

  const sideMenu = document.getElementById("side-menu");
  const menuOverlay = document.getElementById("menu-overlay");
  const openMenu = () => { sideMenu?.classList.add("open"); menuOverlay?.classList.add("open"); document.body.style.overflow = "hidden"; };
  const closeMenu = () => { sideMenu?.classList.remove("open"); menuOverlay?.classList.remove("open"); document.body.style.overflow = ""; };
  document.getElementById("menu-open")?.addEventListener("click", openMenu);
  document.getElementById("menu-close")?.addEventListener("click", closeMenu);
  menuOverlay?.addEventListener("click", closeMenu);

  const sideNav = document.getElementById("side-nav");
  const menuCats = Array.from(new Set([
    ...((typeof CATEGORIES !== "undefined" && CATEGORIES.length) ? CATEGORIES : Object.keys(CANONICAL)),
    "Newest"
  ]));
  if (sideNav) {
    menuCats.forEach(cat => {
      const a = document.createElement("a");
      a.href = "#"; a.textContent = cat; a.dataset.cat = cat;
      a.addEventListener("click", async e => { e.preventDefault(); closeMenu(); await selectCategory(cat); });
      sideNav.appendChild(a);
    });
  }
  document.getElementById("menu-search")?.addEventListener("keydown", e => {
    if (e.key === "Enter") { const q = e.target.value.trim(); if (q) { closeMenu(); runSearch(q); } }
  });
  const searchBar = document.getElementById("search-bar");
  document.getElementById("search-toggle")?.addEventListener("click", () => {
    searchBar?.classList.toggle("open");
    if (searchBar?.classList.contains("open")) document.getElementById("search-input")?.focus();
  });
  document.getElementById("search-form")?.addEventListener("submit", e => {
    e.preventDefault();
    const q = (document.getElementById("search-input")?.value || "").trim();
    if (q) runSearch(q);
  });


  // Session-aware random order. A home-cycle advances when the user opens the
  // home page, opens a video, or returns via browser history, so the next set
  // is different without making ordering unstable during one render.
  function homeCycle() {
    return Number(sessionStorage.getItem("nx_home_cycle") || "0") || 0;
  }
  function advanceHomeCycle(reason) {
    const next = homeCycle() + 1;
    sessionStorage.setItem("nx_home_cycle", String(next));
    if (reason) sessionStorage.setItem("nx_home_cycle_reason", reason);
    return next;
  }
  function isHomePage() {
    return !!document.getElementById("video-feed") && !location.pathname.includes("/pages/");
  }

  // Session-stable random order (changes each browser session and home cycle)
  function sessionSeed() {
    let s = sessionStorage.getItem("nx_seed");
    if (!s) {
      s = String(Date.now() + Math.random());
      sessionStorage.setItem("nx_seed", s);
    }
    return s;
  }
  function hashStr(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function shuffleSeeded(arr, salt) {
    const a = arr.slice();
    const seed = hashStr(sessionSeed() + "|cycle:" + homeCycle() + "|" + (salt || ""));
    let x = seed || 1;
    const rnd = () => {
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      return (x >>> 0) / 4294967296;
    };
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }


  function embedIframeUrl(embedSrc) {
    const raw = String(embedSrc || "").trim();
    if (!raw) return "";
    try {
      const parsed = new URL(raw, location.href);
      if (!/^(www\.)?pornhub\.com$/i.test(parsed.hostname)) return "";
      const match = parsed.pathname.match(/^\/embed\/([a-zA-Z0-9]+)$/);
      if (match) return "https://www.pornhub.com/embed/" + match[1] + parsed.search;
      const key = parsed.searchParams.get("viewkey");
      if (key && /^[a-zA-Z0-9]+$/.test(key)) return "https://www.pornhub.com/embed/" + key;
    } catch (_) {}
    if (/^[a-zA-Z0-9]+$/.test(raw)) return "https://www.pornhub.com/embed/" + raw;
    return "";
  }

  /** Build the official provider iframe without altering its supported URL parameters. */
  function embedIframeHtml(embedSrc, title) {
    const src = embedIframeUrl(embedSrc);
    if (!src) return `<div style="color:#888;padding:24px;text-align:center">Video unavailable</div>`;
    const safeTitle = escapeHtml(title || "Video");
    return `<div class="embed-frame-shell" data-player-state="loading">
      <div class="player-loading" role="status"><span class="player-spinner" aria-hidden="true"></span><span>Connecting to the player…</span></div>
      <div class="player-error" role="alert"><strong>The player could not load</strong><span>It may be a temporary network or provider issue.</span><button type="button" class="player-retry">Try again</button></div>
      <iframe data-player-frame src="${src}" title="${safeTitle}"
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowfullscreen
        loading="eager"
        fetchpriority="high"
        referrerpolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-fullscreen"
        style="width:100%;height:100%;border:0;position:absolute;inset:0"></iframe>
    </div>`;
  }

  function formatViews(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(n);
  }
  function escapeHtml(s) { const d = document.createElement("div"); d.textContent = s || ""; return d.innerHTML; }
  function videoPageUrl(id) {
    // Always internal NexusXXX player — never external hosts
    id = String(id || "").replace(/[^a-zA-Z0-9]/g, "");
    if (!id) return (location.pathname.includes("/pages/") ? "" : "pages/") + "video.html";
    const base = location.pathname.includes("/pages/") ? "" : "pages/";
    return base + "video.html?id=" + encodeURIComponent(id);
  }

  const NAV_VIDEO_PREFIX = "nx_nav_video_";
  function cacheNavigationVideo(video) {
    if (!video?.id) return;
    try {
      sessionStorage.setItem(NAV_VIDEO_PREFIX + video.id, JSON.stringify(video));
    } catch (_) {}
  }
  function readNavigationVideo(id) {
    if (!id) return null;
    try {
      const raw = sessionStorage.getItem(NAV_VIDEO_PREFIX + id);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function ensureVideos() {
    if (typeof VIDEOS === "undefined" || !Array.isArray(VIDEOS)) {
      window.VIDEOS = [];
    }
    return VIDEOS;
  }

  // ---------- LOAD CATEGORY (manifest-driven multi-file path) ----------
  function assetUrls(relativePath) {
    const rel = String(relativePath || "").replace(/^\/+/, "");
    const base = window.location.pathname.includes("/pages/") ? "../js/" : "/js/";
    return [base + rel, "/js/" + rel, "js/" + rel, "../js/" + rel];
  }

  async function fetchJsJson(relativePath) {
    for (const url of assetUrls(relativePath)) {
      try {
        const res = await fetch(url, { cache: "force-cache" });
        if (res.ok) {
          const data = await res.json();
          console.log("[NexusXXX] OK", url);
          return data;
        }
      } catch (_) {}
    }
    return null;
  }

  async function fetchCatalogJson(relativePath) {
    return fetchJsJson("catalog/" + relativePath);
  }

  async function loadCatalogIndex() {
    if (!catalogIndexPromise) {
      catalogIndexPromise = (async () => {
        const data = await fetchCatalogJson("index.json");
        if (!data || !Array.isArray(data.categories)) {
          console.warn("[NexusXXX] Catalog index unavailable; using legacy single-file fallback");
          return null;
        }
        return data;
      })();
    }
    return catalogIndexPromise;
  }

  function siteAssetUrls(relativePath) {
    const rel = String(relativePath || "").replace(/^\/+/, "");
    const base = window.location.pathname.includes("/pages/") ? "../" : "/";
    return [base + rel, "/" + rel, rel, "../" + rel];
  }

  async function fetchSiteJson(relativePath) {
    for (const url of siteAssetUrls(relativePath)) {
      try {
        const res = await fetch(url, { cache: "no-cache" });
        if (res.ok) return await res.json();
      } catch (_) {}
    }
    return null;
  }

  function readSeenVideoIds() {
    try {
      const value = JSON.parse(localStorage.getItem(SEEN_VIDEO_KEY) || "[]");
      return new Set(Array.isArray(value) ? value : []);
    } catch (_) {
      return new Set();
    }
  }

  function rememberSeenVideoIds(ids) {
    const seen = readSeenVideoIds();
    ids.forEach(id => { if (id) seen.add(String(id)); });
    const values = [...seen].slice(-SEEN_VIDEO_MAX);
    try { localStorage.setItem(SEEN_VIDEO_KEY, JSON.stringify(values)); } catch (_) {}
  }

  async function loadFeedIndex() {
    if (!feedIndexPromise) {
      feedIndexPromise = fetchSiteJson("data/pornhub-db-split/feed-index.json");
    }
    return feedIndexPromise;
  }

  function durationText(seconds) {
    const total = Math.max(0, Number(seconds) || 0);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = Math.floor(total % 60);
    return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  }

  function videoFromCsvLine(line, category) {
    const fields = String(line || "").split("|");
    if (fields.length < 13) return null;
    const embedMatch = fields[0].match(/\/embed\/([a-zA-Z0-9]+)/);
    const thumbnail = String(fields[1] || "").trim();
    const title = String(fields[3] || "").trim();
    if (!embedMatch || !thumbnail || !title) return null;
    const id = embedMatch[1];
    return {
      id,
      slug: id,
      title,
      thumb: thumbnail,
      duration: durationText(fields[7]),
      views: Number(fields[8]) || 0,
      category: category || String(fields[5] || "").split(";")[0] || "Video",
      tags: String(fields[4] || "").split(";").map(t => t.trim()).filter(Boolean),
      embedSrc: "https://www.pornhub.com/embed/" + id,
      source: "Pornhub"
    };
  }

  async function sampleCsvPart(part) {
    const min = 128;
    const max = Math.max(min, Number(part.bytes || 0) - 65536);
    const start = Math.floor(Math.random() * (max - min + 1)) + min;
    const end = start + 65535;
    try {
      const response = await fetch("/" + String(part.path).replace(/^\/+/, ""), {
        headers: { Range: `bytes=${start}-${end}` },
        cache: "no-store"
      });
      if (response.status !== 206) {
        try { await response.body?.cancel(); } catch (_) {}
        return null;
      }
      const text = await response.text();
      const lines = text.split(/\r?\n/);
      for (let i = 1; i < lines.length; i++) {
        const video = videoFromCsvLine(lines[i], part.category);
        if (video) return video;
      }
    } catch (_) {}
    return null;
  }

  async function sampleUnseenVideos(target, categoryName) {
    const index = await loadFeedIndex();
    if (!index || !Array.isArray(index.parts) || !index.parts.length) return [];
    const category = categoryName && categoryName !== "all" ? normalizeCat(categoryName) : "";
    const slug = category ? resolveSlug(category) : "";
    const candidates = index.parts.filter(part => !slug || part.categorySlug === slug || String(part.category).toLowerCase() === String(category).toLowerCase());
    if (!candidates.length) return [];
    const reserved = new Set([
      ...readSeenVideoIds(),
      ...unseenFeedVideos.map(video => video.id)
    ]);
    const picked = new Set();
    const result = [];
    let rounds = 0;
    while (result.length < target && rounds < 10) {
      rounds++;
      const count = Math.min(16, Math.max(8, (target - result.length) * 2));
      const batch = await Promise.all(Array.from({ length: count }, () => sampleCsvPart(candidates[Math.floor(Math.random() * candidates.length)])));
      for (const video of batch) {
        if (!video || reserved.has(video.id) || picked.has(video.id)) continue;
        picked.add(video.id);
        result.push(video);
        if (result.length >= target) break;
      }
    }
    return result;
  }

  async function loadFreshFeed(target = PAGE_SIZE * 4, categoryName = "all", append = false) {
    const fresh = await sampleUnseenVideos(target, categoryName);
    if (!fresh.length) return false;
    if (append) unseenFeedVideos.push(...fresh);
    else unseenFeedVideos = fresh;
    const list = ensureVideos();
    const existing = new Set(list.map(v => v.id));
    fresh.forEach(video => { if (!existing.has(video.id)) list.push(video); });
    return true;
  }

  async function loadLatestFeeds() {
    if (latestLoaded) return 0;
    if (!latestIndexPromise) {
      latestIndexPromise = (async () => {
        const index = await fetchSiteJson("latest/index.json");
        if (!index || !Array.isArray(index.latest)) {
          console.warn("[NexusXXX] Latest feed index unavailable");
          return 0;
        }
        const list = ensureVideos();
        const existing = new Set(list.map(v => v.id));
        let added = 0;
        for (const entry of index.latest) {
          const data = await fetchSiteJson("latest/" + entry.file);
          if (!data || !Array.isArray(data.videos)) continue;
          for (const video of data.videos) {
            if (!video || !video.id || existing.has(video.id)) continue;
            video.category = "Newest";
            list.push(video);
            existing.add(video.id);
            added++;
          }
        }
        latestLoaded = true;
        list.sort((a, b) => (b.views || 0) - (a.views || 0));
        console.log("[NexusXXX] +" + added + " latest videos");
        return added;
      })();
    }
    return latestIndexPromise;
  }

  async function loadSearchIndex() {
    if (!searchIndexPromise) {
      searchIndexPromise = (async () => {
        const data = await fetchJsJson("search/index.json");
        if (!data || !data.terms) {
          console.warn("[NexusXXX] Search-intent index unavailable; using local aliases");
          return null;
        }
        return data;
      })();
    }
    return searchIndexPromise;
  }

  async function loadRelatedIndex() {
    if (!relatedIndexPromise) {
      relatedIndexPromise = (async () => {
        const data = await fetchCatalogJson("related.json");
        if (!data || !data.categories) {
          console.warn("[NexusXXX] Related seed index unavailable; using loaded chunks");
          return null;
        }
        return data;
      })();
    }
    return relatedIndexPromise;
  }

  function categoryNameForSlug(slug) {
    if (typeof CATALOG_INDEX !== "undefined") {
      for (const [name, value] of Object.entries(CATALOG_INDEX)) {
        if (value === slug) return name;
      }
    }
    return slug;
  }

  async function loadCategory(name, options = {}) {
    const canonical = normalizeCat(name);
    if (!canonical || canonical === "all") return true;
    if (canonical === "Newest") return loadLatestFeeds();
    if (loadedCategories.has(canonical)) return true;

    // Deduplicate in-flight requests.
    if (loadPromises[canonical]) return loadPromises[canonical];

    const slug = resolveSlug(canonical);
    loadPromises[canonical] = (async () => {
      const index = await loadCatalogIndex();
      const entry = index?.categories?.find(item => item.slug === slug);
      const files = entry?.files?.length
        ? entry.files
        : [entry?.file || (slug + ".json")];
      const state = categoryStates[canonical] || {
        files,
        next: 0,
        total: Number(entry?.count || 0),
        loaded: 0
      };
      state.files = files;
      state.total = Number(entry?.count || state.total || 0);
      categoryStates[canonical] = state;

      // Normal category clicks stream one chunk. Explicit all:true is reserved
      // for tooling/player lookup and should be used sparingly for huge groups.
      const target = options.all ? files.length : Math.min(state.next + 1, files.length);
      const list = ensureVideos();
      const existing = new Set(list.map(v => v.id));
      let added = 0;
      while (state.next < target) {
        const file = files[state.next];
        const data = await fetchCatalogJson(file);
        if (!data || !Array.isArray(data.videos)) {
          console.warn("[NexusXXX] Could not load chunk", canonical, file);
          delete loadPromises[canonical];
          return false;
        }
        data.videos.forEach(v => {
          v.category = data.category || entry?.name || canonical;
          if (!existing.has(v.id)) {
            list.push(v);
            existing.add(v.id);
            added++;
          }
        });
        state.next++;
        state.loaded += data.videos.length;
      }

      if (state.next >= files.length) loadedCategories.add(canonical);
      list.sort((a, b) => (b.views || 0) - (a.views || 0));
      console.log("[NexusXXX] +" + added + " videos for " + canonical + " (" + state.next + "/" + files.length + " chunks)");
      return true;
    })();

    try {
      return await loadPromises[canonical];
    } finally {
      delete loadPromises[canonical];
    }
  }

  function hasMoreCategoryChunks(name) {
    const canonical = normalizeCat(name);
    const state = categoryStates[canonical];
    return !!state && state.next < state.files.length;
  }

  async function loadNextCategoryChunk(name) {
    return loadCategory(name);
  }

  async function loadForQuery(term) {
    const key = String(term || "").toLowerCase().trim();
    const targets = new Set();
    const direct = normalizeCat(term);
    if (CANONICAL[direct]) targets.add(direct);
    if (ALIASES[key]) ALIASES[key].forEach(t => targets.add(t));
    const compact = key.replace(/\s+/g, "");
    Object.keys(ALIASES).forEach(a => {
      if (key.includes(a) || a.includes(key) || compact === a.replace(/\s+/g, "")) {
        ALIASES[a].forEach(t => targets.add(t));
      }
    });

    // Resolve full and tokenized queries through the generated, transparent
    // tag/category index. This improves recall without creating hidden text.
    const searchIndex = await loadSearchIndex();
    const terms = new Set([key, ...key.split(/\s+/).filter(Boolean)]);
    terms.forEach(token => {
      const hit = searchIndex?.terms?.[token];
      if (hit?.categories) hit.categories.forEach(slug => targets.add(categoryNameForSlug(slug)));
    });

    if (typeof CATEGORIES !== "undefined") {
      CATEGORIES.forEach(c => {
        const cl = c.toLowerCase();
        if (cl === key || cl.includes(key) || key.includes(cl)) targets.add(c);
      });
    }
    await Promise.all([...targets].map(t => loadCategory(t)));
  }

  function matchesCategory(v, filter) {
    if (!filter || filter === "all") return true;
    const f = normalizeCat(filter).toLowerCase();
    if (!f) return true;
    if (v.category && String(v.category).toLowerCase() === f) return true;
    // exact tag match only (not partial — avoids wrong categories)
    if (Array.isArray(v.tags)) {
      for (const t of v.tags) {
        const tl = String(t).toLowerCase().trim();
        if (tl === f || tl.replace(/[\s_-]+/g, "") === f.replace(/[\s_-]+/g, "")) return true;
      }
    }
    return false;
  }

  function matchesSearch(v, query) {
    if (!query) return true;
    const q = query.toLowerCase().trim();
    if (!q) return true;
    if (v.title && v.title.toLowerCase().includes(q)) return true;
    if (v.category && v.category.toLowerCase().includes(q)) return true;
    if (Array.isArray(v.tags) && v.tags.some(t => String(t).toLowerCase().includes(q))) return true;
    // alias → category
    if (ALIASES[q] && ALIASES[q].some(a => matchesCategory(v, a))) return true;
    if (matchesCategory(v, query)) return true;
    return false;
  }

  function getList() {
    const all = ensureVideos();
    let list;
    if (currentQuery) list = all.filter(v => matchesSearch(v, currentQuery));
    else if (unseenFeedVideos.length) list = unseenFeedVideos.slice();
    else if (currentFilter !== "all") list = all.filter(v => matchesCategory(v, currentFilter));
    else list = all.slice();
    // Rank by popularity, then session-shuffle within bands so order isn't identical every visit
    list.sort((a, b) => (b.views || 0) - (a.views || 0));
    // Shuffle in chunks of 24 so top videos stay relatively strong but order varies
    const out = [];
    for (let i = 0; i < list.length; i += 24) {
      out.push(...shuffleSeeded(list.slice(i, i + 24), currentFilter + "|" + currentQuery + "|" + i));
    }
    if (currentSort === "newest") {
      out.sort((a, b) => String(b.added || "").localeCompare(String(a.added || "")) || (b.views || 0) - (a.views || 0));
    }
    return out;
  }

  function getRelated(video, limit) {
    limit = limit || 12;
    if (!video) return [];
    const cat = String(video.category || "").toLowerCase();
    const tags = new Set((video.tags || []).map(t => String(t).toLowerCase()));
    const slug = resolveSlug(video.category);
    const localSeed = window.__relatedIndex?.categories?.[slug]?.videos || [];
    const allSeedVideos = Object.values(window.__relatedIndex?.categories || {})
      .flatMap(entry => Array.isArray(entry.videos) ? entry.videos : []);
    const candidates = [];
    const seen = new Set();
    [...localSeed, ...allSeedVideos, ...ensureVideos()].forEach(v => {
      if (!v || !v.id || seen.has(v.id)) return;
      seen.add(v.id);
      candidates.push(v);
    });

    const scored = candidates
      .filter(v => v.id !== video.id)
      .map(v => {
        const sameCategory = String(v.category || "").toLowerCase() === cat;
        const sharedTags = Array.isArray(v.tags)
          ? v.tags.reduce((count, tag) => count + (tags.has(String(tag).toLowerCase()) ? 1 : 0), 0)
          : 0;
        const relevance = (sameCategory ? 100 : 0) + sharedTags * 12;
        return { v, sameCategory, relevance, score: relevance + Math.min(8, Math.log10((v.views || 1) + 1)) };
      });
    const sameCategory = scored.filter(item => item.sameCategory).sort((a, b) => b.score - a.score || (b.v.views || 0) - (a.v.views || 0));
    const crossCategory = scored.filter(item => !item.sameCategory).sort((a, b) => b.score - a.score || (b.v.views || 0) - (a.v.views || 0));
    const sameTarget = Math.min(sameCategory.length, Math.ceil(limit * 0.6));
    const selected = [...sameCategory.slice(0, sameTarget), ...crossCategory.slice(0, limit - sameTarget)];
    if (selected.length < limit) {
      const selectedIds = new Set(selected.map(item => item.v.id));
      selected.push(...scored.filter(item => !selectedIds.has(item.v.id)).sort((a, b) => b.score - a.score).slice(0, limit - selected.length));
    }
    return selected.slice(0, limit).map(item => item.v);
  }

  function bindThumbnailStates(root) {
    if (!root) return;
    root.querySelectorAll("img[data-thumbnail]").forEach(img => {
      const box = img.closest("[data-thumb-state]");
      if (!box) return;
      const markLoaded = () => {
        box.dataset.thumbState = "loaded";
        box.removeAttribute("aria-busy");
      };
      const markFailed = () => {
        const source = img.currentSrc || img.getAttribute("src") || "";
        if (img.dataset.retry !== "1" && /^https?:\/\//i.test(source)) {
          img.dataset.retry = "1";
          const separator = source.includes("?") ? "&" : "?";
          img.src = source + separator + "nx_thumb_retry=" + Date.now();
          return;
        }
        box.dataset.thumbState = "error";
        box.removeAttribute("aria-busy");
      };
      img.addEventListener("load", markLoaded, { once: true });
      img.addEventListener("error", markFailed);
      if (img.complete) {
        if (img.naturalWidth > 0) markLoaded();
        else markFailed();
      }
    });
  }

  function createFeedItem(v) {
    const el = document.createElement("article");
    el.className = "feed-item";
    el.dataset.id = v.id;
    el.dataset.embed = (v.embedSrc && v.embedSrc.includes("/embed/")) ? v.embedSrc : ("https://www.pornhub.com/embed/" + v.id);
    el.innerHTML = `
      <div class="feed-thumb" data-thumb-state="loading" aria-busy="true">
        <span class="thumb-shimmer" aria-hidden="true"></span>
        <img data-thumbnail src="${escapeHtml(v.thumb || "")}" alt="${escapeHtml(v.title || "Video thumbnail")}" loading="lazy" decoding="async">
        <span class="thumb-fallback" role="img" aria-label="Thumbnail unavailable">Thumbnail unavailable</span>
        <div class="play-btn" aria-hidden="true"></div>
        <span class="feed-duration">${escapeHtml(v.duration)}</span>
      </div>
      <div class="feed-body">
        <h3 class="feed-title">${escapeHtml(v.title)}</h3>
        <div class="feed-meta">
          <span class="channel">${escapeHtml(v.category || "Video")}</span>
          <span class="dot">·</span>
          <span>${formatViews(v.views)} views</span>
        </div>
      </div>`;
    el.addEventListener("click", () => {
      if (isHomePage()) advanceHomeCycle("video-click");
      openVideo(v.id, v);
    });
    return el;
  }
  function createAdBanner() {
    const el = document.createElement("div");
    el.className = "feed-ad";
    el.innerHTML = `<div class="feed-ad-label">Advertisement</div><div class="feed-ad-slot" data-ad="infeed-banner">Ad unit</div>`;
    return el;
  }

  function renderFeedLoading() {
    const feed = document.getElementById("video-feed");
    const more = document.getElementById("feed-load-more-wrap");
    if (!feed) return;
    feedReady = false;
    feed.dataset.feedState = "loading";
    if (more) { more.hidden = true; more.style.display = "none"; }
    feed.innerHTML = Array.from({ length: 6 }, () => `
      <article class="feed-skeleton" aria-hidden="true">
        <div class="skeleton-block skeleton-thumb"></div>
        <div class="skeleton-line skeleton-title"></div>
        <div class="skeleton-line skeleton-meta"></div>
      </article>`).join("");
    const label = document.getElementById("feed-label");
    if (label) label.innerHTML = `Loading <span>videos</span><span class="loading-dots" aria-hidden="true">…</span>`;
  }

  function renderFeedFailure() {
    const feed = document.getElementById("video-feed");
    const more = document.getElementById("feed-load-more-wrap");
    if (!feed) return;
    feedReady = false;
    if (more) { more.hidden = true; more.style.display = "none"; }
    feed.dataset.feedState = "error";
    feed.innerHTML = `<div class="feed-status-card" role="alert">
      <strong>Videos could not load</strong>
      <span>Check your connection and try again.</span>
      <button class="btn btn-primary" type="button" id="feed-retry">Try again</button>
    </div>`;
    document.getElementById("feed-retry")?.addEventListener("click", () => {
      renderFeedLoading();
      window.location.reload();
    });
  }

  function setLoading(on) {
    const label = document.getElementById("feed-label");
    if (on) renderFeedLoading();
    if (label && !on) label.innerHTML = `Loading <span>videos</span>`;
  }

  function renderFeed() {
    const feed = document.getElementById("video-feed");
    if (!feed) return;
    stopAllPreviews();
    const list = getList();
    feedReady = true;
    feed.dataset.feedState = list.length ? "ready" : "empty";
    rememberSeenVideoIds(list.slice(0, visibleCount).map(video => video.id));
    feed.innerHTML = "";
    let n = 0;
    list.slice(0, visibleCount).forEach(v => {
      feed.appendChild(createFeedItem(v));
      n++;
      if (n % AD_EVERY === 0) feed.appendChild(createAdBanner());
    });
    const btn = document.getElementById("load-more");
    if (btn) {
      const moreChunks = currentFilter !== "all" && hasMoreCategoryChunks(currentFilter);
      const moreWrap = document.getElementById("feed-load-more-wrap") || btn.closest(".load-more-wrap");
      if (moreWrap) moreWrap.hidden = !feedReady;
      btn.style.display = feedReady && (visibleCount < list.length || moreChunks) ? "inline-flex" : "none";
      btn.textContent = moreChunks && visibleCount >= list.length ? "Load more videos" : "Load more";
    }
    const label = document.getElementById("feed-label");
    if (label) {
      if (currentQuery) label.innerHTML = `Results · <span>${escapeHtml(currentQuery)}</span> <small style="color:#666">(${list.length})</small>`;
      else if (currentFilter !== "all") {
        const state = categoryStates[normalizeCat(currentFilter)];
        const total = state?.total || list.length;
        const loaded = state?.loaded || list.length;
        label.innerHTML = `${escapeHtml(normalizeCat(currentFilter))} <span>Videos</span> <small style="color:#666">(${loaded.toLocaleString()} loaded / ${total.toLocaleString()} total)</small>`;
      } else label.innerHTML = currentSort === "newest" ? `Newest <span>Videos</span>` : `Hot <span>Videos</span>`;
    }
    if (list.length === 0) {
      feed.innerHTML = `<div style="grid-column:1/-1;padding:48px;text-align:center;color:#888">
        No videos found for this category.<br><small style="color:#555">Try another category or check that js/catalog/ is deployed.</small>
      </div>`;
    }
    bindThumbnailStates(feed);
    setupPreviewObserver();
    setupFeedInterstitialObserver();
    hydrateAdSlots(feed);
  }

  function stopAllPreviews() {
    document.querySelectorAll(".feed-thumb.previewing").forEach(thumb => {
      thumb.classList.remove("previewing");
      thumb.querySelector(".feed-preview")?.remove();
    });
    activePreviewId = null;
  }
  function startPreview(item) {
    const id = item.dataset.id;
    if (activePreviewId === id) return;
    stopAllPreviews();
    const thumb = item.querySelector(".feed-thumb");
    if (!thumb) return;
    const iframe = document.createElement("iframe");
    iframe.className = "feed-preview";
    iframe.setAttribute("allow", "autoplay; encrypted-media");
    let src = item.dataset.embed || "";
    const mid = src.match(/\/embed\/([a-zA-Z0-9]+)/);
    if (mid) src = "https://www.pornhub.com/embed/" + mid[1];
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation allow-fullscreen");
    iframe.setAttribute("referrerpolicy", "no-referrer");
    iframe.src = src + (src.includes("?") ? "&" : "?") + "autoplay=1&muted=1";
    thumb.appendChild(iframe);
    thumb.classList.add("previewing");
    activePreviewId = id;
  }
  function setupPreviewObserver() {
    if (previewObserver) previewObserver.disconnect();
    if (!("IntersectionObserver" in window)) return;
    previewObserver = new IntersectionObserver((entries) => {
      let best = null, bestRatio = 0.55;
      entries.forEach(en => {
        if (en.isIntersecting && en.intersectionRatio > bestRatio) { bestRatio = en.intersectionRatio; best = en.target; }
      });
      if (best) startPreview(best);
      else if (!entries.some(e => e.isIntersecting && e.intersectionRatio > 0.35)) stopAllPreviews();
    }, { threshold: [0.35, 0.55, 0.7, 0.85], rootMargin: "-10% 0px -10% 0px" });
    document.querySelectorAll(".feed-item").forEach(el => previewObserver.observe(el));
  }

  function setupFeedInterstitialObserver() {
    if (feedInterstitialObserver) feedInterstitialObserver.disconnect();
    if (feedScrollInterstitialShown || !("IntersectionObserver" in window)) return;
    feedInterstitialObserver = new IntersectionObserver(entries => {
      const qualifyingEntry = entries.find(entry => entry.isIntersecting && entry.intersectionRatio >= 0.6);
      if (!qualifyingEntry || feedScrollInterstitialShown) return;
      feedScrollInterstitialShown = true;
      sessionStorage.setItem("nx_feed_scroll_interstitial_shown", "1");
      feedInterstitialObserver?.disconnect();
      showInterstitial();
    }, { threshold: [0.6], rootMargin: "0px 0px -18% 0px" });
    document.querySelectorAll(".feed-item").forEach(el => feedInterstitialObserver.observe(el));
  }

  async function selectCategory(cat) {
    if (isFiltering) return;
    isFiltering = true;
    currentFilter = cat === "all" ? "all" : normalizeCat(cat);
    currentQuery = "";
    visibleCount = PAGE_SIZE;
    document.querySelectorAll(".trend-chip").forEach(c => {
      const chipCat = (c.dataset.cat || "").toLowerCase();
      c.classList.toggle("active", currentFilter === "all" ? chipCat === "all" : chipCat === currentFilter.toLowerCase());
    });
    document.querySelectorAll("#side-nav a").forEach(a => {
      a.classList.toggle("active", (a.dataset.cat || "").toLowerCase() === String(currentFilter).toLowerCase());
    });
    setLoading(true);
    try {
      unseenFeedVideos = [];
      if (currentFilter !== "all") {
        await loadCategory(currentFilter);
      }
      await loadFreshFeed(PAGE_SIZE * 4, currentFilter);
      renderFeed();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("[NexusXXX] category load failed", error);
      renderFeedFailure();
    } finally {
      isFiltering = false;
    }
  }

  async function runSearch(q) {
    unseenFeedVideos = [];
    currentQuery = q;
    currentFilter = "all";
    visibleCount = PAGE_SIZE;
    document.querySelectorAll(".trend-chip").forEach(c => c.classList.remove("active"));
    setLoading(true);
    try {
      await loadForQuery(q);
      renderFeed();
    } catch (error) {
      console.error("[NexusXXX] search failed", error);
      renderFeedFailure();
    }
  }

  function openVideo(id, video = null) {
    if (video) cacheNavigationVideo(video);
    const url = videoPageUrl(id);
    // Refuse any non-NexusXXX navigation
    if (/pornhub\.com|phncdn\.com/i.test(url)) return;
    if (isHomePage()) advanceHomeCycle("open-video");
    showInterstitial(() => { location.href = url; });
  }
  function hydrateAdSlots(root = document) {
    const configured = window.NEXUS_AD_TARGETS || {};
    const slots = root === document
      ? [...document.querySelectorAll("[data-ad]")]
      : [...(root.matches?.("[data-ad]") ? [root] : []), ...root.querySelectorAll?.("[data-ad]") || []];
    slots.forEach(slot => {
      if (slot.dataset.adBound === "1") return;
      const destination = String(slot.dataset.adHref || configured[slot.dataset.ad] || "").trim();
      if (!/^https?:\/\//i.test(destination)) return;
      slot.dataset.adBound = "1";
      slot.classList.add("ad-clickable");
      slot.setAttribute("role", "link");
      slot.setAttribute("tabindex", "0");
      const follow = () => {
        const opened = window.open(destination, "_blank", "noopener,noreferrer");
        if (!opened) location.assign(destination);
      };
      slot.addEventListener("click", follow);
      slot.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); follow(); }
      });
    });
  }

  function showInterstitial(onContinue = () => {}) {
    let modal = document.getElementById("interstitial");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "interstitial";
      modal.className = "interstitial";
      modal.innerHTML = `<div class="interstitial-box"><div class="ad-label">Advertisement</div><div class="interstitial-slot" data-ad="interstitial">Interstitial ad unit</div><button class="interstitial-close" id="interstitial-continue">Continue</button></div>`;
      document.body.appendChild(modal);
      hydrateAdSlots(modal);
      const btn = document.getElementById("interstitial-continue");
      btn.addEventListener("click", () => {
        modal.classList.remove("open");
        const continueAction = modal.__continueAction || (() => {});
        modal.__continueAction = null;
        continueAction();
      });
    }
    modal.__continueAction = onContinue;
    modal.classList.add("open");
  }

  hydrateAdSlots();

  const trendRow = document.getElementById("trend-row");
  if (trendRow && !trendRow.children.length) {
    ["All","Newest","Amateur","Big Ass","Asian","Babe","Big Dick","MILF","Lesbian","Anal","Squirt","Masturbation"].forEach((cat, i) => {
      const b = document.createElement("button");
      b.className = "trend-chip" + (i === 0 ? " active" : "");
      b.textContent = cat;
      b.dataset.cat = cat === "All" ? "all" : cat;
      b.addEventListener("click", () => selectCategory(cat === "All" ? "all" : cat));
      trendRow.appendChild(b);
    });
  }

  document.getElementById("load-more")?.addEventListener("click", async () => {
    const button = document.getElementById("load-more");
    if (button) { button.disabled = true; button.classList.add("is-loading"); }
    try {
      if (currentFilter !== "all" && visibleCount >= ensureVideos().length && hasMoreCategoryChunks(currentFilter)) {
        await loadNextCategoryChunk(currentFilter);
      }
      await loadFreshFeed(PAGE_SIZE * 2, currentFilter, true);
      visibleCount += PAGE_SIZE;
      renderFeed();
    } catch (error) {
      console.error("[NexusXXX] load more failed", error);
      renderFeedFailure();
    } finally {
      if (button) { button.disabled = false; button.classList.remove("is-loading"); }
    }
  });

  const params = new URLSearchParams(location.search);
  if (location.pathname.includes("popular.html")) currentSort = "popular";
  if (location.pathname.includes("newest.html")) currentSort = "newest";

  // Boot feed
  (async function boot() {
    if (!document.getElementById("video-feed")) return;
    renderFeedLoading();
    try {
      advanceHomeCycle("open");
      await loadLatestFeeds();
      if (params.get("cat")) await selectCategory(params.get("cat"));
      else if (params.get("q")) await runSearch(params.get("q"));
      else {
        await loadFreshFeed(PAGE_SIZE * 4, "all");
        renderFeed();
      }
    } catch (error) {
      console.error("[NexusXXX] feed boot failed", error);
      renderFeedFailure();
    }
  })();

  window.addEventListener("pageshow", event => {
    if (isHomePage() && event.persisted) {
      advanceHomeCycle("history-return");
      visibleCount = PAGE_SIZE;
      currentFilter = "all";
      currentQuery = "";
      unseenFeedVideos = [];
      renderFeedLoading();
      loadFreshFeed(PAGE_SIZE * 4, "all").then(() => renderFeed()).catch(error => {
        console.error("[NexusXXX] history refresh failed", error);
        renderFeedFailure();
      });
    }
    const playerWrap = document.getElementById("player-iframe");
    if (playerWrap && (event.persisted || !playerWrap.querySelector("iframe"))) {
      window.setTimeout(() => initPlayer({ force: event.persisted }), 0);
    }
  });

  // ---------- Player ----------
  let playerInitPromise = null;
  if (document.getElementById("player-root") || location.pathname.includes("video.html")) {
    initPlayer();
  }

  async function initPlayer(options = {}) {
    if (playerInitPromise) return playerInitPromise;
    playerInitPromise = initPlayerOnce(options);
    try {
      return await playerInitPromise;
    } finally {
      playerInitPromise = null;
    }
  }

  function renderPlayerUnavailable(message = "This video record is not available in the current session.") {
    const wrap = document.getElementById("player-iframe");
    if (wrap) {
      wrap.innerHTML = `<div class="player-unavailable" role="alert"><span class="player-status-icon" aria-hidden="true">!</span><strong>Video unavailable</strong><span>${escapeHtml(message)}</span><button type="button" class="player-retry" onclick="location.reload()">Reload video</button></div>`;
    }
    const title = document.getElementById("video-title");
    if (title) title.textContent = "Video unavailable";
    const views = document.getElementById("video-views");
    if (views) views.textContent = "Please return to the feed and try again";
    const duration = document.getElementById("video-duration");
    if (duration) duration.textContent = "";
    document.getElementById("share-copy")?.setAttribute("disabled", "disabled");
  }

  async function initPlayerOnce(options = {}) {
    const force = Boolean(options.force);
    const id = new URLSearchParams(location.search).get("id");
    ensureVideos();
    let video = id ? (VIDEOS.find(v => v.id === id) || readNavigationVideo(id)) : null;

    // Never scan every category chunk here: doing so can allocate hundreds of
    // megabytes on mobile and is the cause of renderer crashes on direct links.
    if (!video) {
      renderPlayerUnavailable(id ? "Open this video again from the feed to refresh its record." : "No video was selected.");
      return;
    }

    document.title = video.title + " | NexusXXX";
    // Social / link preview meta
    (function setShareMeta() {
      const setMeta = (sel, attr, val) => {
        const el = document.querySelector(sel) || document.getElementById(sel.replace("#",""));
        if (el && val) el.setAttribute(attr, val);
      };
      const url = location.href;
      const title = video.title + " | NexusXXX";
      const img = socialPreviewImage(video);
      setMeta('meta[property="og:title"]', "content", title);
      setMeta('meta[property="og:image"]', "content", img);
      setMeta('meta[property="og:image:secure_url"]', "content", img);
      setMeta('meta[property="og:image:type"]', "content", socialPreviewType(img));
      setMeta('meta[property="og:image:alt"]', "content", title + " video preview");
      setMeta('meta[property="og:url"]', "content", url);
      setMeta('meta[name="twitter:title"]', "content", title);
      setMeta('meta[name="twitter:image"]', "content", img);
      setMeta('meta[name="twitter:image:alt"]', "content", title + " video preview");
    })();

    const wrap = document.getElementById("player-iframe");
    if (wrap) {
      const existing = wrap.querySelector("iframe");
      const expectedEmbed = embedIframeUrl(video.embedSrc);
      if (force || !existing || existing.dataset.embedSrc !== expectedEmbed) {
        wrap.innerHTML = embedIframeHtml(video.embedSrc, video.title);
        const frame = wrap.querySelector("iframe");
        if (frame) {
          frame.dataset.embedSrc = expectedEmbed;
          frame.dataset.videoId = video.id;
          frame.loading = "eager";
          const shell = frame.closest(".embed-frame-shell");
          let retryCount = 0;
          let retryTimer = null;
          const setPlayerState = state => { if (shell) shell.dataset.playerState = state; };
          const retryFrame = () => {
            if (!frame.isConnected) return;
            if (retryCount >= 1) {
              setPlayerState("error");
              return;
            }
            retryCount += 1;
            setPlayerState("loading");
            frame.dataset.loaded = "0";
            frame.src = expectedEmbed + (expectedEmbed.includes("?") ? "&" : "?") + "nx_retry=" + Date.now();
            retryTimer = window.setTimeout(() => {
              if (frame.isConnected && frame.dataset.loaded !== "1") setPlayerState("error");
            }, 10000);
          };
          frame.addEventListener("load", () => {
            frame.dataset.loaded = "1";
            setPlayerState("loaded");
            if (retryTimer) window.clearTimeout(retryTimer);
          });
          shell?.querySelector(".player-retry")?.addEventListener("click", () => {
            retryCount = 0;
            retryFrame();
          });
          retryTimer = window.setTimeout(retryFrame, 10000);
        }
      }
    }
    const set = (i, t) => { const el = document.getElementById(i); if (el) el.textContent = t; };
    set("video-title", video.title);
    set("video-views", formatViews(video.views) + " views");
    set("video-duration", video.duration);
    const catEl = document.getElementById("video-category");
    if (catEl) {
      catEl.textContent = video.category;
      catEl.href = "../index.html?cat=" + encodeURIComponent(video.category || "");
      catEl.onclick = e => { e.preventDefault(); location.href = "../index.html?cat=" + encodeURIComponent(video.category || ""); };
    }
    const tagsEl = document.getElementById("video-tags");
    if (tagsEl && video.tags) {
      tagsEl.innerHTML = video.tags.map(t =>
        `<a class="tag" href="../index.html?q=${encodeURIComponent(t)}">${escapeHtml(t)}</a>`
      ).join("");
    }
    const copyButton = document.getElementById("share-copy");
    if (copyButton) {
      copyButton.disabled = false;
      copyButton.onclick = async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        const b = document.getElementById("share-copy");
        if (b) { b.textContent = "Copied!"; setTimeout(() => b.textContent = "Copy link", 1500); }
      } catch { prompt("Copy:", location.href); }
      };
    }
    const native = document.getElementById("share-native");
    if (native && navigator.share) {
      native.style.display = "inline-flex";
      native.onclick = () => navigator.share({ title: video.title, url: location.href }).catch(() => {});
    }

    // Load the first category chunk and a lightweight cross-category seed so
    // Up next renders immediately while the remaining catalog stays chunked.
    await loadCategory(video.category);
    window.__relatedIndex = await loadRelatedIndex();
    // Expose the current video for Up next and related load-more.
    window.__relatedVideo = video;
    window.__relatedShown = 0;
    renderRelated(true);
  }

  function renderRelated(reset) {
    const related = document.getElementById("related-list");
    const moreWrap = document.getElementById("related-load-more-wrap");
    if (!related) return;
    const video = window.__relatedVideo;
    if (!video) return;

    const STEP = 12;
    if (reset) window.__relatedShown = 0;

    // Get a larger pool, session-shuffled for variety
    let pool = getRelated(video, 80);
    pool = shuffleSeeded(pool, "rel|" + video.id);

    window.__relatedShown = Math.min((window.__relatedShown || 0) + STEP, pool.length);
    const list = pool.slice(0, window.__relatedShown);

    if (!list.length) {
      related.innerHTML = `<p style="color:#666;padding:12px">No related videos</p>`;
      if (moreWrap) moreWrap.style.display = "none";
      return;
    }

    let html = "";
    list.forEach((v, i) => {
      html += `
        <a class="related-item" href="#" data-id="${v.id}">
          <div class="related-thumb-wrap" data-thumb-state="loading" aria-busy="true">
            <span class="thumb-shimmer" aria-hidden="true"></span>
            <img class="related-thumb" data-thumbnail src="${escapeHtml(v.thumb || "")}" alt="${escapeHtml(v.title || "Video thumbnail")}" loading="lazy" decoding="async">
            <span class="thumb-fallback" role="img" aria-label="Thumbnail unavailable">Thumbnail unavailable</span>
          </div>
          <div class="related-info">
            <h4>${escapeHtml(v.title)}</h4>
            <span>${escapeHtml(v.category)} · ${v.duration} · ${formatViews(v.views)}</span>
          </div>
        </a>`;
      if ((i + 1) % 3 === 0) {
        html += `
        <div class="related-ad" data-ad="related-banner">
          <div class="related-ad-label">Advertisement</div>
          <div class="related-ad-slot">Banner ad</div>
        </div>`;
      }
    });
    related.innerHTML = html;
    bindThumbnailStates(related);

    // Interstitial every 2 clicks also from related list
    related.querySelectorAll(".related-item").forEach(a => {
      a.addEventListener("click", e => {
        e.preventDefault();
        openVideo(a.dataset.id, getList().find(video => video.id === a.dataset.id) || null);
      });
    });

    if (moreWrap) {
      moreWrap.style.display = window.__relatedShown >= pool.length ? "none" : "block";
    }
  }

  const catGrid = document.getElementById("category-grid");
  if (catGrid) {
    menuCats.forEach(cat => {
      const a = document.createElement("a");
      a.className = "cat-card";
      a.href = "../index.html?cat=" + encodeURIComponent(cat);
      a.textContent = cat;
      catGrid.appendChild(a);
    });
  }
  document.getElementById("related-load-more")?.addEventListener("click", async () => {
    const video = window.__relatedVideo;
    const button = document.getElementById("related-load-more");
    if (button) { button.disabled = true; button.textContent = "Loading…"; }
    if (video && hasMoreCategoryChunks(video.category)) {
      await loadNextCategoryChunk(video.category);
    }
    renderRelated(false);
    if (button) { button.disabled = false; button.textContent = "Load more"; }
  });
  document.getElementById("sticky-ad-close")?.addEventListener("click", () => {
    document.getElementById("sticky-ad")?.classList.add("hidden");
  });

  window.NexusXXX = {
    version: "match-ads-1.0",
    loadCategory,
    loadNextCategoryChunk,
    hasMoreCategoryChunks,
    matchesCategory,
    getRelated,
    loadedCategories,
    categoryStates,
    catalogBase
  };
})();
