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
  const INTERSTITIAL_EVERY = 2;

  const loadedCategories = new Set();
  const loadPromises = {}; // prevent duplicate fetches
  const categoryStates = {}; // { canonical: { files, next, total, loaded } }
  let catalogIndexPromise = null;
  let visibleCount = PAGE_SIZE;
  let currentFilter = "all";
  let currentSort = "popular";
  let currentQuery = "";
  let videoClickCount = parseInt(sessionStorage.getItem("nx_clicks") || "0", 10) || 0;
  let activePreviewId = null;
  let previewObserver = null;
  let isFiltering = false;

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
    "Double Penetration":"double-penetration","Latino":"latino"
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
    "rough sex":["Rough Sex"]
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

  // ---------- Age / menu (same as before) ----------
  const ageGate = document.getElementById("age-gate");
  if (localStorage.getItem("nexusxxx_age_verified") === "true") ageGate?.classList.add("hidden");
  document.getElementById("age-enter")?.addEventListener("click", () => {
    localStorage.setItem("nexusxxx_age_verified", "true");
    ageGate?.classList.add("hidden");
  });
  document.getElementById("age-exit")?.addEventListener("click", () => { location.href = "https://www.google.com"; });

  const sideMenu = document.getElementById("side-menu");
  const menuOverlay = document.getElementById("menu-overlay");
  const openMenu = () => { sideMenu?.classList.add("open"); menuOverlay?.classList.add("open"); document.body.style.overflow = "hidden"; };
  const closeMenu = () => { sideMenu?.classList.remove("open"); menuOverlay?.classList.remove("open"); document.body.style.overflow = ""; };
  document.getElementById("menu-open")?.addEventListener("click", openMenu);
  document.getElementById("menu-close")?.addEventListener("click", closeMenu);
  menuOverlay?.addEventListener("click", closeMenu);

  const sideNav = document.getElementById("side-nav");
  const menuCats = (typeof CATEGORIES !== "undefined" && CATEGORIES.length)
    ? CATEGORIES
    : Object.keys(CANONICAL);
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


  // Session-stable random order (changes each browser session, not each click)
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
    const seed = hashStr(sessionSeed() + "|" + (salt || ""));
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


  /** Build embed iframe HTML — blocks navigation out to Pornhub */
  function embedIframeHtml(embedSrc, title) {
    let src = embedSrc || "";
    // ONLY embed player URL — never view_video / pornhub.com browse links
    let id = null;
    const m1 = src.match(/\/embed\/([a-zA-Z0-9]+)/);
    const m2 = src.match(/[?&]viewkey=([a-zA-Z0-9]+)/);
    if (m1) id = m1[1];
    else if (m2) id = m2[1];
    else if (/^[a-zA-Z0-9]+$/.test(src)) id = src;
    if (!id) return `<div style="color:#888;padding:24px;text-align:center">Video unavailable</div>`;
    src = "https://www.pornhub.com/embed/" + id;
    const safeTitle = escapeHtml(title || "Video");
    // Critical: no allow-top-navigation, no allow-popups, no allow-popups-to-escape-sandbox
    // Clicks inside the player cannot leave NexusXXX
    return `<iframe src="${src}" title="${safeTitle}"
      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      allowfullscreen
      loading="lazy"
      referrerpolicy="no-referrer"
      sandbox="allow-scripts allow-same-origin allow-presentation allow-fullscreen"
      style="width:100%;height:100%;border:0;position:absolute;inset:0"></iframe>`;
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

  function ensureVideos() {
    if (typeof VIDEOS === "undefined" || !Array.isArray(VIDEOS)) {
      window.VIDEOS = [];
    }
    return VIDEOS;
  }

  // ---------- LOAD CATEGORY (manifest-driven multi-file path) ----------
  function catalogUrls(relativePath) {
    const rel = String(relativePath || "").replace(/^\/+/, "");
    return [
      catalogBase() + rel,
      "/js/catalog/" + rel,
      "js/catalog/" + rel,
      "../js/catalog/" + rel
    ];
  }

  async function fetchCatalogJson(relativePath) {
    for (const url of catalogUrls(relativePath)) {
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

  async function loadCategory(name, options = {}) {
    const canonical = normalizeCat(name);
    if (!canonical || canonical === "all") return true;
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
    // strip spaces for bigdick etc
    const compact = key.replace(/\s+/g, "");
    Object.keys(ALIASES).forEach(a => {
      if (key.includes(a) || a.includes(key) || compact === a.replace(/\s+/g, "")) {
        ALIASES[a].forEach(t => targets.add(t));
      }
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
    const scored = [];
    for (const v of ensureVideos()) {
      if (v.id === video.id) continue;
      let score = 0;
      if (v.category && String(v.category).toLowerCase() === cat) score += 100;
      if (Array.isArray(v.tags)) {
        v.tags.forEach(t => { if (tags.has(String(t).toLowerCase())) score += 12; });
      }
      if (score >= 100) scored.push({ v, score: score + Math.min(8, Math.log10((v.views || 1) + 1)) });
    }
    if (scored.length < limit) {
      for (const v of ensureVideos()) {
        if (v.id === video.id || scored.some(s => s.v.id === v.id)) continue;
        let score = 0;
        if (Array.isArray(v.tags)) v.tags.forEach(t => { if (tags.has(String(t).toLowerCase())) score += 12; });
        if (score >= 12) scored.push({ v, score });
      }
    }
    scored.sort((a, b) => b.score - a.score || (b.v.views || 0) - (a.v.views || 0));
    return scored.slice(0, limit).map(s => s.v);
  }

  function createFeedItem(v) {
    const el = document.createElement("article");
    el.className = "feed-item";
    el.dataset.id = v.id;
    el.dataset.embed = (v.embedSrc && v.embedSrc.includes("/embed/")) ? v.embedSrc : ("https://www.pornhub.com/embed/" + v.id);
    el.innerHTML = `
      <div class="feed-thumb">
        <img src="${v.thumb}" alt="" loading="lazy"
          onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22640%22 height=%22360%22%3E%3Crect fill=%22%23111%22 width=%22640%22 height=%22360%22/%3E%3C/svg%3E'">
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
    el.addEventListener("click", () => openVideo(v.id));
    return el;
  }
  function createAdBanner() {
    const el = document.createElement("div");
    el.className = "feed-ad";
    el.innerHTML = `<div class="feed-ad-label">Advertisement</div><div class="feed-ad-slot" data-ad="infeed-banner">Ad unit</div>`;
    return el;
  }

  function setLoading(on) {
    const label = document.getElementById("feed-label");
    if (!label) return;
    if (on) label.innerHTML = `Loading <span>…</span>`;
  }

  function renderFeed() {
    const feed = document.getElementById("video-feed");
    if (!feed) return;
    stopAllPreviews();
    const list = getList();
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
      btn.style.display = (visibleCount < list.length || moreChunks) ? "inline-flex" : "none";
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
    setupPreviewObserver();
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
      if (currentFilter !== "all") {
        await loadCategory(currentFilter);
      }
      renderFeed();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      isFiltering = false;
    }
  }

  async function runSearch(q) {
    currentQuery = q;
    currentFilter = "all";
    visibleCount = PAGE_SIZE;
    document.querySelectorAll(".trend-chip").forEach(c => c.classList.remove("active"));
    setLoading(true);
    await loadForQuery(q);
    renderFeed();
  }

  function openVideo(id) {
    const url = videoPageUrl(id);
    // Refuse any non-NexusXXX navigation
    if (/pornhub\.com|phncdn\.com/i.test(url)) return;
    videoClickCount++;
    sessionStorage.setItem("nx_clicks", String(videoClickCount));
    if (videoClickCount % INTERSTITIAL_EVERY === 0) showInterstitial(() => { location.href = url; });
    else location.href = url;
  }
  function showInterstitial(onContinue) {
    let modal = document.getElementById("interstitial");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "interstitial";
      modal.className = "interstitial";
      modal.innerHTML = `<div class="interstitial-box"><div class="ad-label">Advertisement</div><div class="interstitial-slot" data-ad="interstitial">Interstitial ad unit</div><button class="interstitial-close" id="interstitial-continue">Continue to video</button></div>`;
      document.body.appendChild(modal);
    }
    modal.classList.add("open");
    const btn = document.getElementById("interstitial-continue");
    const handler = () => { modal.classList.remove("open"); btn.removeEventListener("click", handler); onContinue(); };
    btn.addEventListener("click", handler);
  }

  const trendRow = document.getElementById("trend-row");
  if (trendRow && !trendRow.children.length) {
    ["All","Amateur","Big Ass","Asian","Babe","Big Dick","MILF","Lesbian","Anal","Squirt","Masturbation"].forEach((cat, i) => {
      const b = document.createElement("button");
      b.className = "trend-chip" + (i === 0 ? " active" : "");
      b.textContent = cat;
      b.dataset.cat = cat === "All" ? "all" : cat;
      b.addEventListener("click", () => selectCategory(cat === "All" ? "all" : cat));
      trendRow.appendChild(b);
    });
  }

  document.getElementById("load-more")?.addEventListener("click", async () => {
    if (currentFilter !== "all" && visibleCount >= ensureVideos().length && hasMoreCategoryChunks(currentFilter)) {
      await loadNextCategoryChunk(currentFilter);
    }
    visibleCount += PAGE_SIZE;
    renderFeed();
  });

  const params = new URLSearchParams(location.search);
  if (location.pathname.includes("popular.html")) currentSort = "popular";
  if (location.pathname.includes("newest.html")) currentSort = "newest";

  // Boot feed
  (async function boot() {
    if (!document.getElementById("video-feed")) return;
    if (params.get("cat")) await selectCategory(params.get("cat"));
    else if (params.get("q")) await runSearch(params.get("q"));
    else renderFeed();
  })();

  // ---------- Player ----------
  if (document.getElementById("player-root") || location.pathname.includes("video.html")) {
    initPlayer();
  }

  async function initPlayer() {
    const id = new URLSearchParams(location.search).get("id");
    ensureVideos();
    let video = VIDEOS.find(v => v.id === id);

    // Search across category files until found
    if (!video && id && typeof CATEGORIES !== "undefined") {
      for (const cat of CATEGORIES) {
        await loadCategory(cat);
        video = VIDEOS.find(v => v.id === id);
        if (video) break;
      }
    }
    if (!video) video = VIDEOS[0];
    if (!video) return;

    document.title = video.title + " | NexusXXX";
    // Social / link preview meta
    (function setShareMeta() {
      const setMeta = (sel, attr, val) => {
        const el = document.querySelector(sel) || document.getElementById(sel.replace("#",""));
        if (el && val) el.setAttribute(attr, val);
      };
      const url = location.href;
      const title = video.title + " | NexusXXX";
      const desc = (video.category ? video.category + " · " : "") + formatViews(video.views) + " views · Watch on NexusXXX";
      const img = video.thumb || "";
      setMeta('meta[property="og:title"]', "content", title);
      setMeta('meta[property="og:description"]', "content", desc);
      setMeta('meta[property="og:image"]', "content", img);
      setMeta('meta[property="og:url"]', "content", url);
      setMeta('meta[name="twitter:title"]', "content", title);
      setMeta('meta[name="twitter:description"]', "content", desc);
      setMeta('meta[name="twitter:image"]', "content", img);
      const md = document.querySelector('meta[name="description"]');
      if (md) md.setAttribute("content", desc);
    })();

    const wrap = document.getElementById("player-iframe");
    if (wrap) {
      wrap.innerHTML = embedIframeHtml(video.embedSrc, video.title);
    }
    const set = (i, t) => { const el = document.getElementById(i); if (el) el.textContent = t; };
    set("video-title", video.title);
    set("video-views", formatViews(video.views) + " views");
    set("video-duration", video.duration);
    const catEl = document.getElementById("video-category");
    if (catEl) {
      catEl.textContent = video.category;
      catEl.href = "../index.html?cat=" + encodeURIComponent(video.category || "");
      catEl.addEventListener("click", e => { e.preventDefault(); location.href = "../index.html?cat=" + encodeURIComponent(video.category || ""); });
    }
    const tagsEl = document.getElementById("video-tags");
    if (tagsEl && video.tags) {
      tagsEl.innerHTML = video.tags.map(t =>
        `<a class="tag" href="../index.html?q=${encodeURIComponent(t)}">${escapeHtml(t)}</a>`
      ).join("");
    }
    document.getElementById("share-copy")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        const b = document.getElementById("share-copy");
        if (b) { b.textContent = "Copied!"; setTimeout(() => b.textContent = "Copy link", 1500); }
      } catch { prompt("Copy:", location.href); }
    });
    const native = document.getElementById("share-native");
    if (native && navigator.share) {
      native.style.display = "inline-flex";
      native.onclick = () => navigator.share({ title: video.title, url: location.href }).catch(() => {});
    }

    // Related: load full category first
    await loadCategory(video.category);
    // expose for load-more on related
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
          <img class="related-thumb" src="${v.thumb}" alt="" loading="lazy">
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

    // Interstitial every 2 clicks also from related list
    related.querySelectorAll(".related-item").forEach(a => {
      a.addEventListener("click", e => {
        e.preventDefault();
        openVideo(a.dataset.id);
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
  document.getElementById("related-load-more")?.addEventListener("click", () => renderRelated(false));
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
