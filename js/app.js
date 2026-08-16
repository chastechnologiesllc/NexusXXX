/**
 * NexusXXX Premium v2
 * Feed + desktop grid + play pulse + scroll preview + ads + category filter
 */
(function () {
  "use strict";

  const CATALOG_BASE = window.location.pathname.includes("/pages/")
    ? "../js/catalog/"
    : "js/catalog/";
  const PAGE_SIZE = 12;
  const AD_EVERY = 3;           // banner every N videos
  const INTERSTITIAL_EVERY = 2; // interstitial every N video opens
  const PREVIEW_ROOT = "https://www.pornhub.com/embed/";

  const loadedCategories = new Set();
  let visibleCount = PAGE_SIZE;
  let currentFilter = "all";
  let currentSort = "popular";
  let currentQuery = "";
  let videoClickCount = 0;
  let activePreviewId = null;
  let previewObserver = null;

  // Extra niche aliases → category or tag match
  const NICHE_ALIASES = {
    "masturbation": ["Masturbation", "Solo Female", "Solo Male"],
    "masturbating": ["Masturbation", "Solo Female"],
    "squirt": ["Squirt"],
    "squirting": ["Squirt"],
    "fingering": ["Masturbation", "Lesbian", "Solo Female"],
    "finger": ["Masturbation", "Lesbian"],
    "big dick": ["Big Dick"],
    "big cock": ["Big Dick"],
    "bbc": ["Big Dick", "Interracial", "Ebony"],
    "pawg": ["Big Ass"],
    "booty": ["Big Ass"],
    "tits": ["Big Tits"],
    "boobs": ["Big Tits"],
    "blow job": ["Blowjob"],
    "bj": ["Blowjob"],
    "cum shot": ["Cumshot"],
    "creampie": ["Creampie"],
    "anal": ["Anal"],
    "threesome": ["Threesome"],
    "gangbang": ["Gangbang", "Orgy"],
    "lesbian": ["Lesbian"],
    "milf": ["MILF", "Mature"],
    "teen": ["Teen"],
    "amateur": ["Amateur", "Verified Amateurs"],
  };

  // ---------- Age gate ----------
  const ageGate = document.getElementById("age-gate");
  if (localStorage.getItem("nexusxxx_age_verified") === "true") ageGate?.classList.add("hidden");
  document.getElementById("age-enter")?.addEventListener("click", () => {
    localStorage.setItem("nexusxxx_age_verified", "true");
    ageGate?.classList.add("hidden");
  });
  document.getElementById("age-exit")?.addEventListener("click", () => {
    location.href = "https://www.google.com";
  });

  // ---------- Side menu ----------
  const sideMenu = document.getElementById("side-menu");
  const menuOverlay = document.getElementById("menu-overlay");
  const openMenu = () => { sideMenu?.classList.add("open"); menuOverlay?.classList.add("open"); document.body.style.overflow = "hidden"; };
  const closeMenu = () => { sideMenu?.classList.remove("open"); menuOverlay?.classList.remove("open"); document.body.style.overflow = ""; };
  document.getElementById("menu-open")?.addEventListener("click", openMenu);
  document.getElementById("menu-close")?.addEventListener("click", closeMenu);
  menuOverlay?.addEventListener("click", closeMenu);

  // Build category list in menu (main + niche labels)
  const sideNav = document.getElementById("side-nav");
  const MENU_NICHES = [
    "Amateur", "Big Ass", "Big Dick", "Big Tits", "Asian", "Babe", "Blonde", "Brunette",
    "Blowjob", "MILF", "Lesbian", "Anal", "Ebony", "Latina", "Japanese", "Teen",
    "Masturbation", "Squirt", "Handjob", "Creampie", "Cumshot", "Threesome", "Orgy",
    "POV", "Public", "Fetish", "Bondage", "Hentai", "Pornstar", "Webcam", "Reality"
  ];
  if (sideNav) {
    const cats = typeof CATEGORIES !== "undefined" ? CATEGORIES : MENU_NICHES;
    // Prefer ordered niches first, then rest
    const ordered = [];
    MENU_NICHES.forEach(c => { if (cats.includes(c) || true) ordered.push(c); });
    cats.forEach(c => { if (!ordered.includes(c)) ordered.push(c); });
    // dedupe
    [...new Set(ordered)].forEach(cat => {
      const a = document.createElement("a");
      a.href = "#";
      a.textContent = cat;
      a.dataset.cat = cat;
      a.addEventListener("click", async e => {
        e.preventDefault();
        closeMenu();
        await selectCategory(cat);
      });
      sideNav.appendChild(a);
    });
  }

  document.getElementById("menu-search")?.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      const q = e.target.value.trim();
      if (q) { closeMenu(); runSearch(q); }
    }
  });

  // Search toggle
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

  // ---------- Helpers ----------
  function formatViews(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(n);
  }
  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s || "";
    return d.innerHTML;
  }
  function videoPageUrl(id) {
    return (location.pathname.includes("/pages/") ? "" : "pages/") + "video.html?id=" + encodeURIComponent(id);
  }

  // ---------- Catalog ----------
  async function loadCategory(name) {
    if (!name || name === "all" || loadedCategories.has(name)) return;
    const slug = (typeof CATALOG_INDEX !== "undefined" && CATALOG_INDEX[name])
      ? CATALOG_INDEX[name]
      : name.toLowerCase().replace(/\s+/g, "-");
    try {
      const res = await fetch(CATALOG_BASE + slug + ".json");
      if (!res.ok) return;
      const data = await res.json();
      if (!data?.videos) return;
      const existing = new Set(VIDEOS.map(v => v.id));
      data.videos.forEach(v => {
        if (!existing.has(v.id)) { VIDEOS.push(v); existing.add(v.id); }
      });
      loadedCategories.add(name);
      VIDEOS.sort((a, b) => b.views - a.views);
    } catch (_) {}
  }

  // Load several related categories for niche searches
  async function loadAliases(term) {
    const key = term.toLowerCase();
    const targets = NICHE_ALIASES[key] || [];
    for (const t of targets) await loadCategory(t);
    // also try exact category name
    const exact = (typeof CATEGORIES !== "undefined" ? CATEGORIES : []).find(
      c => c.toLowerCase() === key
    );
    if (exact) await loadCategory(exact);
  }

  function matchesFilter(v, filter) {
    if (!filter || filter === "all") return true;
    const f = filter.toLowerCase();
    if (v.category && v.category.toLowerCase() === f) return true;
    if (v.tags && v.tags.some(t => t === f || t.includes(f))) return true;
    // alias expansion
    const aliases = NICHE_ALIASES[f];
    if (aliases) {
      return aliases.some(a =>
        (v.category && v.category.toLowerCase() === a.toLowerCase()) ||
        (v.tags && v.tags.some(t => t.includes(a.toLowerCase())))
      );
    }
    // partial title match for niche words
    if (v.title && v.title.toLowerCase().includes(f)) return true;
    return false;
  }

  function getList() {
    let list = [...VIDEOS];
    if (currentQuery) {
      const q = currentQuery.toLowerCase();
      list = list.filter(v =>
        (v.title && v.title.toLowerCase().includes(q)) ||
        (v.tags && v.tags.some(t => t.includes(q))) ||
        (v.category && v.category.toLowerCase().includes(q)) ||
        matchesFilter(v, q)
      );
    } else if (currentFilter !== "all") {
      list = list.filter(v => matchesFilter(v, currentFilter));
    }
    if (currentSort === "popular") list.sort((a, b) => b.views - a.views);
    else list.sort((a, b) => (b.added || "").localeCompare(a.added || "") || b.views - a.views);
    return list;
  }

  // ---------- Feed item ----------
  function createFeedItem(v) {
    const el = document.createElement("article");
    el.className = "feed-item";
    el.dataset.id = v.id;
    el.dataset.embed = v.embedSrc || (PREVIEW_ROOT + v.id);
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
      </div>
    `;
    el.addEventListener("click", () => openVideo(v.id));
    return el;
  }

  function createAdBanner() {
    const el = document.createElement("div");
    el.className = "feed-ad";
    el.innerHTML = `
      <div class="feed-ad-label">Advertisement</div>
      <div class="feed-ad-slot" data-ad="infeed-banner">Ad unit — banner / native</div>
    `;
    return el;
  }

  // ---------- Render ----------
  function renderFeed() {
    const feed = document.getElementById("video-feed");
    if (!feed) return;
    stopAllPreviews();
    const list = getList();
    feed.innerHTML = "";
    let videoIdx = 0;
    list.slice(0, visibleCount).forEach((v, i) => {
      feed.appendChild(createFeedItem(v));
      videoIdx++;
      // Insert ad every AD_EVERY videos
      if (videoIdx % AD_EVERY === 0) feed.appendChild(createAdBanner());
    });
    const btn = document.getElementById("load-more");
    if (btn) btn.style.display = visibleCount >= list.length ? "none" : "inline-flex";
    const label = document.getElementById("feed-label");
    if (label) {
      if (currentQuery) label.innerHTML = `Results · <span>${escapeHtml(currentQuery)}</span>`;
      else if (currentFilter !== "all") label.innerHTML = `${escapeHtml(currentFilter)} <span>Videos</span>`;
      else label.innerHTML = currentSort === "newest" ? `Newest <span>Videos</span>` : `Hot <span>Videos</span>`;
    }
    setupPreviewObserver();
  }

  // ---------- Scroll preview (one at a time) ----------
  function stopAllPreviews() {
    document.querySelectorAll(".feed-thumb.previewing").forEach(thumb => {
      thumb.classList.remove("previewing");
      const iframe = thumb.querySelector(".feed-preview");
      if (iframe) iframe.remove();
    });
    activePreviewId = null;
  }

  function startPreview(item) {
    const id = item.dataset.id;
    if (activePreviewId === id) return;
    stopAllPreviews();
    const thumb = item.querySelector(".feed-thumb");
    if (!thumb) return;
    const embed = item.dataset.embed;
    // muted autoplay embed — browsers often block sound; PH embed may limit autoplay
    const iframe = document.createElement("iframe");
    iframe.className = "feed-preview";
    iframe.setAttribute("loading", "lazy");
    iframe.setAttribute("allow", "autoplay; encrypted-media");
    iframe.src = embed + (embed.includes("?") ? "&" : "?") + "autoplay=1&muted=1";
    thumb.appendChild(iframe);
    thumb.classList.add("previewing");
    activePreviewId = id;
  }

  function setupPreviewObserver() {
    if (previewObserver) previewObserver.disconnect();
    // Only enable previews on mobile-ish / when user has interacted (autoplay policies)
    if (!("IntersectionObserver" in window)) return;
    previewObserver = new IntersectionObserver((entries) => {
      // Find most visible feed-item
      let best = null;
      let bestRatio = 0.55;
      entries.forEach(en => {
        if (en.isIntersecting && en.intersectionRatio > bestRatio) {
          bestRatio = en.intersectionRatio;
          best = en.target;
        }
      });
      if (best) startPreview(best);
      else {
        // if none highly visible, stop
        const anyVisible = entries.some(e => e.isIntersecting && e.intersectionRatio > 0.35);
        if (!anyVisible) stopAllPreviews();
      }
    }, { threshold: [0.35, 0.55, 0.7, 0.85], rootMargin: "-10% 0px -10% 0px" });

    document.querySelectorAll(".feed-item").forEach(el => previewObserver.observe(el));
  }

  // ---------- Navigation ----------
  async function selectCategory(cat) {
    currentFilter = cat;
    currentQuery = "";
    visibleCount = PAGE_SIZE;
    document.querySelectorAll(".trend-chip").forEach(c => {
      c.classList.toggle("active", (c.dataset.cat || "").toLowerCase() === cat.toLowerCase());
    });
    await loadCategory(cat);
    await loadAliases(cat);
    renderFeed();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function runSearch(q) {
    currentQuery = q;
    currentFilter = "all";
    visibleCount = PAGE_SIZE;
    document.querySelectorAll(".trend-chip").forEach(c => c.classList.remove("active"));
    await loadAliases(q);
    renderFeed();
  }

  function openVideo(id) {
    videoClickCount++;
    // Interstitial every N clicks
    if (videoClickCount % INTERSTITIAL_EVERY === 0) {
      showInterstitial(() => {
        location.href = videoPageUrl(id);
      });
    } else {
      location.href = videoPageUrl(id);
    }
  }

  // ---------- Interstitial ----------
  function showInterstitial(onContinue) {
    let modal = document.getElementById("interstitial");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "interstitial";
      modal.className = "interstitial";
      modal.innerHTML = `
        <div class="interstitial-box">
          <div class="ad-label">Advertisement</div>
          <div class="interstitial-slot" data-ad="interstitial">Interstitial ad unit</div>
          <button class="interstitial-close" id="interstitial-continue">Continue to video</button>
          <div class="interstitial-skip">Ad · you can continue in a moment</div>
        </div>
      `;
      document.body.appendChild(modal);
    }
    modal.classList.add("open");
    const btn = document.getElementById("interstitial-continue");
    const handler = () => {
      modal.classList.remove("open");
      btn.removeEventListener("click", handler);
      onContinue();
    };
    btn.addEventListener("click", handler);
  }

  // ---------- Trend chips ----------
  const trendRow = document.getElementById("trend-row");
  if (trendRow) {
    const tops = ["All", "Amateur", "Big Ass", "Asian", "Babe", "Big Dick", "MILF", "Lesbian", "Anal", "Squirt", "Masturbation"];
    tops.forEach((cat, i) => {
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
    if (currentFilter !== "all") {
      await loadCategory(currentFilter);
      await loadAliases(currentFilter);
    }
    renderFeed();
  });

  // URL params
  const params = new URLSearchParams(location.search);
  if (location.pathname.includes("popular.html")) currentSort = "popular";
  if (location.pathname.includes("newest.html")) currentSort = "newest";

  if (document.getElementById("video-feed")) {
    if (params.get("cat")) selectCategory(params.get("cat"));
    else if (params.get("q")) runSearch(params.get("q"));
    else renderFeed();
  }

  // ---------- Player page ----------
  if (document.getElementById("player-root") || location.pathname.includes("video.html")) {
    initPlayer();
  }

  async function initPlayer() {
    const id = new URLSearchParams(location.search).get("id");
    let video = typeof VIDEOS !== "undefined" ? VIDEOS.find(v => v.id === id) : null;
    if (!video && typeof VIDEOS !== "undefined") video = VIDEOS[0];
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

    await loadCategory(video.category);
    const related = document.getElementById("related-list");
    if (related) {
      const list = VIDEOS.filter(v => v.id !== video.id && v.category === video.category)
        .sort((a, b) => b.views - a.views).slice(0, 10);
      const fb = list.length ? list : VIDEOS.filter(v => v.id !== video.id).slice(0, 10);
      related.innerHTML = fb.map(v => `
        <a class="related-item" href="video.html?id=${v.id}">
          <img class="related-thumb" src="${v.thumb}" alt="" loading="lazy">
          <div class="related-info">
            <h4>${escapeHtml(v.title)}</h4>
            <span>${v.duration} · ${formatViews(v.views)} views</span>
          </div>
        </a>
      `).join("");
    }
  }

  // Categories grid page
  const catGrid = document.getElementById("category-grid");
  if (catGrid) {
    const list = typeof CATEGORIES !== "undefined" ? CATEGORIES : MENU_NICHES;
    list.forEach(cat => {
      const a = document.createElement("a");
      a.className = "cat-card";
      a.href = "../index.html?cat=" + encodeURIComponent(cat);
      a.textContent = cat;
      catGrid.appendChild(a);
    });
  }

  // Sticky ad close
  document.getElementById("sticky-ad-close")?.addEventListener("click", () => {
    document.getElementById("sticky-ad")?.classList.add("hidden");
  });

  window.NexusXXX = { VIDEOS, version: "premium-v2" };
})();
