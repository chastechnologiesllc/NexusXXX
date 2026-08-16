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
  let visibleCount = PAGE_SIZE;
  let currentFilter = "all";
  let currentSort = "popular";
  let currentQuery = "";
  let videoClickCount = 0;
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

  function formatViews(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(n);
  }
  function escapeHtml(s) { const d = document.createElement("div"); d.textContent = s || ""; return d.innerHTML; }
  function videoPageUrl(id) {
    return (location.pathname.includes("/pages/") ? "" : "pages/") + "video.html?id=" + encodeURIComponent(id);
  }

  function ensureVideos() {
    if (typeof VIDEOS === "undefined" || !Array.isArray(VIDEOS)) {
      window.VIDEOS = [];
    }
    return VIDEOS;
  }

  // ---------- LOAD CATEGORY (critical path) ----------
  async function loadCategory(name) {
    const canonical = normalizeCat(name);
    if (!canonical || canonical === "all") return true;
    if (loadedCategories.has(canonical)) return true;

    // Deduplicate in-flight requests
    if (loadPromises[canonical]) return loadPromises[canonical];

    const slug = resolveSlug(canonical);
    const urls = [
      catalogBase() + slug + ".json",
      "js/catalog/" + slug + ".json",
      "/js/catalog/" + slug + ".json",
      "../js/catalog/" + slug + ".json"
    ];

    loadPromises[canonical] = (async () => {
      let data = null;
      for (const url of urls) {
        try {
          const res = await fetch(url, { cache: "force-cache" });
          if (res.ok) {
            data = await res.json();
            console.log("[NexusXXX] OK", url);
            break;
          }
        } catch (_) {}
      }
      if (!data || !Array.isArray(data.videos)) {
        console.warn("[NexusXXX] Could not load category:", canonical, slug);
        delete loadPromises[canonical];
        return false;
      }
      const list = ensureVideos();
      const existing = new Set(list.map(v => v.id));
      let added = 0;
      data.videos.forEach(v => {
        // Normalize category to canonical file category
        v.category = data.category || canonical;
        if (!existing.has(v.id)) {
          list.push(v);
          existing.add(v.id);
          added++;
        }
      });
      loadedCategories.add(canonical);
      list.sort((a, b) => (b.views || 0) - (a.views || 0));
      console.log("[NexusXXX] +" + added + " videos for " + canonical);
      return true;
    })();

    return loadPromises[canonical];
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
    if (currentSort === "popular") list.sort((a, b) => (b.views || 0) - (a.views || 0));
    else list.sort((a, b) => String(b.added || "").localeCompare(String(a.added || "")) || (b.views || 0) - (a.views || 0));
    return list;
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
    el.dataset.embed = v.embedSrc || ("https://www.pornhub.com/embed/" + v.id);
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
    if (btn) btn.style.display = visibleCount >= list.length ? "none" : "inline-flex";
    const label = document.getElementById("feed-label");
    if (label) {
      if (currentQuery) label.innerHTML = `Results · <span>${escapeHtml(currentQuery)}</span> <small style="color:#666">(${list.length})</small>`;
      else if (currentFilter !== "all") label.innerHTML = `${escapeHtml(normalizeCat(currentFilter))} <span>Videos</span> <small style="color:#666">(${list.length})</small>`;
      else label.innerHTML = currentSort === "newest" ? `Newest <span>Videos</span>` : `Hot <span>Videos</span>`;
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
    iframe.src = item.dataset.embed + (item.dataset.embed.includes("?") ? "&" : "?") + "autoplay=1&muted=1";
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
        await loadForQuery(currentFilter);
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
    videoClickCount++;
    if (videoClickCount % INTERSTITIAL_EVERY === 0) showInterstitial(() => { location.href = videoPageUrl(id); });
    else location.href = videoPageUrl(id);
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
    visibleCount += PAGE_SIZE;
    if (currentFilter !== "all") { await loadCategory(currentFilter); await loadForQuery(currentFilter); }
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
    const wrap = document.getElementById("player-iframe");
    if (wrap) {
      wrap.innerHTML = `<iframe src="${video.embedSrc}" allowfullscreen allow="autoplay; fullscreen; picture-in-picture" loading="lazy" title="${escapeHtml(video.title)}"></iframe>`;
    }
    const set = (i, t) => { const el = document.getElementById(i); if (el) el.textContent = t; };
    set("video-title", video.title);
    set("video-views", formatViews(video.views) + " views");
    set("video-duration", video.duration);
    const catEl = document.getElementById("video-category");
    if (catEl) {
      catEl.textContent = video.category;
      catEl.href = "../index.html?cat=" + encodeURIComponent(video.category);
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
    const related = document.getElementById("related-list");
    if (related) {
      const list = getRelated(video, 15);
      if (!list.length) {
        related.innerHTML = `<p style="color:#666;padding:12px">No related videos</p>`;
      } else {
        let html = "";
        list.forEach((v, i) => {
          html += `
        <a class="related-item" href="video.html?id=${v.id}">
          <img class="related-thumb" src="${v.thumb}" alt="" loading="lazy">
          <div class="related-info">
            <h4>${escapeHtml(v.title)}</h4>
            <span>${escapeHtml(v.category)} · ${v.duration} · ${formatViews(v.views)}</span>
          </div>
        </a>`;
          // Banner every 3 related videos
          if ((i + 1) % 3 === 0) {
            html += `
        <div class="related-ad" data-ad="related-banner">
          <div class="related-ad-label">Advertisement</div>
          <div class="related-ad-slot">Banner ad</div>
        </div>`;
          }
        });
        related.innerHTML = html;
      }
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
  document.getElementById("sticky-ad-close")?.addEventListener("click", () => {
    document.getElementById("sticky-ad")?.classList.add("hidden");
  });

  window.NexusXXX = {
    version: "match-ads-1.0",
    loadCategory,
    matchesCategory,
    getRelated,
    loadedCategories,
    catalogBase
  };
})();
