/**
 * NexusXXX Premium — Feed UI
 */
(function () {
  "use strict";

  const CATALOG_BASE = (function () {
    if (window.location.pathname.includes("/pages/")) return "../js/catalog/";
    return "js/catalog/";
  })();
  const PAGE_SIZE = 12;
  const loadedCategories = new Set();
  let visibleCount = PAGE_SIZE;
  let currentFilter = "all";
  let currentSort = "popular";
  let currentQuery = "";

  // ----- Age gate -----
  const ageGate = document.getElementById("age-gate");
  const AGE_KEY = "nexusxxx_age_verified";
  if (localStorage.getItem(AGE_KEY) === "true" && ageGate) ageGate.classList.add("hidden");
  document.getElementById("age-enter")?.addEventListener("click", () => {
    localStorage.setItem(AGE_KEY, "true");
    ageGate?.classList.add("hidden");
  });
  document.getElementById("age-exit")?.addEventListener("click", () => {
    window.location.href = "https://www.google.com";
  });

  // ----- Side menu -----
  const sideMenu = document.getElementById("side-menu");
  const menuOverlay = document.getElementById("menu-overlay");
  function openMenu() {
    sideMenu?.classList.add("open");
    menuOverlay?.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeMenu() {
    sideMenu?.classList.remove("open");
    menuOverlay?.classList.remove("open");
    document.body.style.overflow = "";
  }
  document.getElementById("menu-open")?.addEventListener("click", openMenu);
  document.getElementById("menu-close")?.addEventListener("click", closeMenu);
  menuOverlay?.addEventListener("click", closeMenu);

  // Populate categories in side menu
  const sideNav = document.getElementById("side-nav");
  if (sideNav && typeof CATEGORIES !== "undefined") {
    CATEGORIES.forEach(cat => {
      const a = document.createElement("a");
      a.href = "#";
      a.textContent = cat;
      a.dataset.cat = cat;
      a.addEventListener("click", async (e) => {
        e.preventDefault();
        closeMenu();
        await selectCategory(cat);
      });
      sideNav.appendChild(a);
    });
  }

  // Menu search
  document.getElementById("menu-search")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const q = e.target.value.trim();
      if (q) {
        closeMenu();
        runSearch(q);
      }
    }
  });

  // ----- Search toggle -----
  const searchBar = document.getElementById("search-bar");
  document.getElementById("search-toggle")?.addEventListener("click", () => {
    searchBar?.classList.toggle("open");
    if (searchBar?.classList.contains("open")) {
      document.getElementById("search-input")?.focus();
    }
  });
  document.getElementById("search-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = (document.getElementById("search-input")?.value || "").trim();
    if (q) runSearch(q);
  });

  // ----- Helpers -----
  function formatViews(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(n);
  }
  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str || "";
    return d.innerHTML;
  }
  function videoUrl(id) {
    const base = window.location.pathname.includes("/pages/") ? "" : "pages/";
    return `${base}video.html?id=${encodeURIComponent(id)}`;
  }

  // ----- Catalog load -----
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
        if (!existing.has(v.id)) {
          VIDEOS.push(v);
          existing.add(v.id);
        }
      });
      loadedCategories.add(name);
      VIDEOS.sort((a, b) => b.views - a.views);
    } catch (e) {
      console.warn("Category load failed", name, e);
    }
  }

  function getList() {
    let list = [...VIDEOS];
    if (currentQuery) {
      const q = currentQuery.toLowerCase();
      list = list.filter(v =>
        (v.title && v.title.toLowerCase().includes(q)) ||
        (v.tags && v.tags.some(t => t.includes(q))) ||
        (v.category && v.category.toLowerCase().includes(q))
      );
    } else if (currentFilter !== "all") {
      const f = currentFilter.toLowerCase();
      list = list.filter(v =>
        (v.category && v.category.toLowerCase() === f) ||
        (v.tags && v.tags.some(t => t === f || t.includes(f)))
      );
    }
    if (currentSort === "popular") list.sort((a, b) => b.views - a.views);
    else list.sort((a, b) => (b.added || "").localeCompare(a.added || "") || b.views - a.views);
    return list;
  }

  function createFeedItem(v) {
    const el = document.createElement("article");
    el.className = "feed-item";
    el.innerHTML = `
      <div class="feed-thumb">
        <img src="${v.thumb}" alt="" loading="lazy"
          onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22640%22 height=%22360%22%3E%3Crect fill=%22%23111%22 width=%22640%22 height=%22360%22/%3E%3C/svg%3E'">
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
    el.addEventListener("click", () => { window.location.href = videoUrl(v.id); });
    return el;
  }

  function renderFeed() {
    const feed = document.getElementById("video-feed");
    if (!feed) return;
    const list = getList();
    feed.innerHTML = "";
    list.slice(0, visibleCount).forEach(v => feed.appendChild(createFeedItem(v)));
    const btn = document.getElementById("load-more");
    if (btn) btn.style.display = visibleCount >= list.length ? "none" : "inline-flex";
    const label = document.getElementById("feed-label");
    if (label) {
      if (currentQuery) label.innerHTML = `Results for “<span>${escapeHtml(currentQuery)}</span>”`;
      else if (currentFilter !== "all") label.innerHTML = `${escapeHtml(currentFilter)} <span>Videos</span>`;
      else label.innerHTML = currentSort === "newest" ? `Newest <span>Videos</span>` : `Hot <span>Videos</span>`;
    }
  }

  async function selectCategory(cat) {
    currentFilter = cat;
    currentQuery = "";
    visibleCount = PAGE_SIZE;
    // highlight trend chips
    document.querySelectorAll(".trend-chip").forEach(c => {
      c.classList.toggle("active", c.dataset.cat === cat);
    });
    await loadCategory(cat);
    renderFeed();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function runSearch(q) {
    currentQuery = q;
    currentFilter = "all";
    visibleCount = PAGE_SIZE;
    document.querySelectorAll(".trend-chip").forEach(c => c.classList.remove("active"));
    renderFeed();
  }

  // ----- Trend chips -----
  const trendRow = document.getElementById("trend-row");
  if (trendRow && typeof CATEGORIES !== "undefined") {
    const top = CATEGORIES.slice(0, 10);
    // "All" chip
    const allChip = document.createElement("button");
    allChip.className = "trend-chip active";
    allChip.textContent = "All";
    allChip.dataset.cat = "all";
    allChip.addEventListener("click", () => selectCategory("all"));
    trendRow.appendChild(allChip);
    top.forEach(cat => {
      const b = document.createElement("button");
      b.className = "trend-chip";
      b.textContent = cat;
      b.dataset.cat = cat;
      b.addEventListener("click", () => selectCategory(cat));
      trendRow.appendChild(b);
    });
  }

  // Load more
  document.getElementById("load-more")?.addEventListener("click", async () => {
    visibleCount += PAGE_SIZE;
    if (currentFilter !== "all") await loadCategory(currentFilter);
    renderFeed();
  });

  // URL params
  const params = new URLSearchParams(window.location.search);
  const catParam = params.get("cat");
  const qParam = params.get("q");

  // Page-aware defaults
  if (window.location.pathname.includes("popular.html")) currentSort = "popular";
  if (window.location.pathname.includes("newest.html")) currentSort = "newest";

  // Init feed
  if (document.getElementById("video-feed")) {
    if (catParam) selectCategory(catParam);
    else if (qParam) runSearch(qParam);
    else renderFeed();
  }

  // ----- Player page -----
  if (document.getElementById("player-root") || window.location.pathname.includes("video.html")) {
    initPlayer();
  }

  async function initPlayer() {
    const id = new URLSearchParams(window.location.search).get("id");
    let video = (typeof VIDEOS !== "undefined") ? VIDEOS.find(v => v.id === id) : null;
    if (!video && typeof VIDEOS !== "undefined") video = VIDEOS[0];
    if (!video) return;

    document.title = `${video.title} | NexusXXX`;
    const iframeWrap = document.getElementById("player-iframe");
    if (iframeWrap) {
      iframeWrap.innerHTML = `<iframe src="${video.embedSrc}" allowfullscreen allow="autoplay; fullscreen; picture-in-picture" loading="lazy" title="${escapeHtml(video.title)}"></iframe>`;
    }
    const set = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
    set("video-title", video.title);
    set("video-views", formatViews(video.views) + " views");
    set("video-duration", video.duration);
    const catEl = document.getElementById("video-category");
    if (catEl) {
      catEl.textContent = video.category;
      catEl.href = "../index.html?cat=" + encodeURIComponent(video.category);
    }

    // tags
    const tagsEl = document.getElementById("video-tags");
    if (tagsEl && video.tags) {
      tagsEl.innerHTML = video.tags.map(t =>
        `<a class="tag" href="../index.html?q=${encodeURIComponent(t)}">${escapeHtml(t)}</a>`
      ).join("");
    }

    // share
    const shareUrl = window.location.href;
    document.getElementById("share-copy")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(shareUrl);
        const btn = document.getElementById("share-copy");
        if (btn) { btn.textContent = "Copied!"; setTimeout(() => btn.textContent = "Copy link", 1500); }
      } catch { prompt("Copy:", shareUrl); }
    });
    const native = document.getElementById("share-native");
    if (native && navigator.share) {
      native.style.display = "inline-flex";
      native.addEventListener("click", () => {
        navigator.share({ title: video.title, url: shareUrl }).catch(() => {});
      });
    }

    // related
    await loadCategory(video.category);
    const related = document.getElementById("related-list");
    if (related) {
      const list = VIDEOS.filter(v => v.id !== video.id && v.category === video.category)
        .sort((a, b) => b.views - a.views)
        .slice(0, 10);
      const fallback = list.length ? list : VIDEOS.filter(v => v.id !== video.id).slice(0, 10);
      related.innerHTML = fallback.map(v => `
        <a class="related-item" href="video.html?id=${v.id}">
          <img class="related-thumb" src="${v.thumb}" alt="" loading="lazy">
          <div class="related-info">
            <h4>${escapeHtml(v.title)}</h4>
            <span>${v.duration} · ${formatViews(v.views)} views</span>
          </div>
        </a>
      `).join("");
    }

    // schema
    const schema = {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: video.title,
      thumbnailUrl: video.thumb,
      uploadDate: video.added || "2024-01-01",
      embedUrl: video.embedSrc
    };
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.textContent = JSON.stringify(schema);
    document.head.appendChild(s);
  }

  // Categories page tiles
  const catGrid = document.getElementById("category-grid");
  if (catGrid && typeof CATEGORIES !== "undefined") {
    CATEGORIES.forEach(cat => {
      const a = document.createElement("a");
      a.className = "cat-card";
      a.href = "../index.html?cat=" + encodeURIComponent(cat);
      a.textContent = cat;
      catGrid.appendChild(a);
    });
  }

  window.NexusXXX = { VIDEOS, CATEGORIES, version: "premium-feed-1.0" };
})();
