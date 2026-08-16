/**
 * NexusXXX Core Application Logic
 * Production v2 — Split catalog with on-demand category loading
 * Pure frontend, static hosting ready
 */
(function () {
  "use strict";

  // ---------- Config ----------
  const CATALOG_BASE = (function () {
    // Works from both root and /pages/
    if (window.location.pathname.includes("/pages/")) return "../js/catalog/";
    return "js/catalog/";
  })();

  const INITIAL_VISIBLE = 24;
  const LOAD_MORE_STEP = 24;
  const loadedCategories = new Set(); // track which category JSONs we already fetched

  // ---------- Age Gate ----------
  const ageGate = document.getElementById("age-gate");
  const AGE_KEY = "nexusxxx_age_verified";

  function checkAge() {
    if (localStorage.getItem(AGE_KEY) === "true") {
      if (ageGate) ageGate.classList.add("hidden");
    }
  }

  if (document.getElementById("age-enter")) {
    document.getElementById("age-enter").addEventListener("click", () => {
      localStorage.setItem(AGE_KEY, "true");
      ageGate.classList.add("hidden");
    });
  }
  if (document.getElementById("age-exit")) {
    document.getElementById("age-exit").addEventListener("click", () => {
      window.location.href = "https://www.google.com";
    });
  }
  checkAge();

  // ---------- Mobile Menu ----------
  const mobileToggle = document.getElementById("mobile-toggle");
  const mobileNav = document.getElementById("mobile-nav");
  if (mobileToggle && mobileNav) {
    mobileToggle.addEventListener("click", () => {
      mobileNav.classList.toggle("open");
    });
  }

  // ---------- Helpers ----------
  function formatViews(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(n);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  function createCard(video) {
    const card = document.createElement("article");
    card.className = "video-card";
    card.dataset.id = video.id;
    card.innerHTML = `
      <div class="thumb-wrap">
        <img src="${video.thumb}" alt="${escapeHtml(video.title)}" loading="lazy" width="640" height="360"
             onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22640%22 height=%22360%22%3E%3Crect fill=%22%2316161a%22 width=%22640%22 height=%22360%22/%3E%3Ctext fill=%22%23a0a0b0%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 font-family=%22sans-serif%22%3ENo Thumb%3C/text%3E%3C/svg%3E'">
        <span class="duration">${video.duration}</span>
        <span class="quality-badge">HD</span>
      </div>
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(video.title)}</h3>
        <div class="card-meta">
          <span>${formatViews(video.views)} views</span>
          <span>${escapeHtml(video.category)}</span>
        </div>
      </div>
    `;
    card.addEventListener("click", () => {
      const base = window.location.pathname.includes("/pages/") ? "" : "pages/";
      window.location.href = `${base}video.html?id=${encodeURIComponent(video.id)}`;
    });
    return card;
  }

  // ---------- Catalog loader ----------
  async function loadCategory(categoryName) {
    if (!categoryName || categoryName === "all") return;
    if (loadedCategories.has(categoryName)) return;

    const slug = (typeof CATALOG_INDEX !== "undefined" && CATALOG_INDEX[categoryName])
      ? CATALOG_INDEX[categoryName]
      : categoryName.toLowerCase().replace(/\s+/g, "-").replace(/\//g, "-");

    try {
      const res = await fetch(CATALOG_BASE + slug + ".json");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (data && Array.isArray(data.videos)) {
        // Merge without duplicates
        const existing = new Set(VIDEOS.map(v => v.id));
        let added = 0;
        data.videos.forEach(v => {
          if (!existing.has(v.id)) {
            VIDEOS.push(v);
            existing.add(v.id);
            added++;
          }
        });
        loadedCategories.add(categoryName);
        // Keep global list sorted by views
        VIDEOS.sort((a, b) => b.views - a.views);
        console.log(`[NexusXXX] Loaded ${added} videos for ${categoryName}`);
      }
    } catch (err) {
      console.warn(`[NexusXXX] Could not load category ${categoryName}:`, err.message);
    }
  }

  // ---------- Home / Grid Logic ----------
  const grid = document.getElementById("video-grid");
  const chips = document.getElementById("category-chips");
  const sectionTitle = document.getElementById("section-title");
  const loadMoreBtn = document.getElementById("load-more");
  let currentFilter = "all";
  let currentSort = "popular";
  let visibleCount = INITIAL_VISIBLE;
  let isLoadingCategory = false;

  function getFiltered() {
    let list = [...VIDEOS];
    if (currentFilter !== "all") {
      const f = currentFilter.toLowerCase();
      list = list.filter(v =>
        (v.category && v.category.toLowerCase() === f) ||
        (v.tags && v.tags.some(t => t.toLowerCase() === f || t.toLowerCase().includes(f)))
      );
    }
    if (currentSort === "popular") {
      list.sort((a, b) => b.views - a.views);
    } else {
      list.sort((a, b) => {
        const da = new Date(b.added || 0) - new Date(a.added || 0);
        return da !== 0 ? da : b.views - a.views;
      });
    }
    return list;
  }

  function renderGrid() {
    if (!grid) return;
    const list = getFiltered();
    grid.innerHTML = "";
    list.slice(0, visibleCount).forEach(v => grid.appendChild(createCard(v)));
    if (loadMoreBtn) {
      loadMoreBtn.style.display = visibleCount >= list.length ? "none" : "inline-flex";
    }
    if (sectionTitle) {
      sectionTitle.textContent = currentFilter === "all"
        ? (currentSort === "popular" ? "Popular Videos" : "Latest Videos")
        : currentFilter + " Videos";
    }
  }

  async function selectCategory(cat) {
    currentFilter = cat;
    visibleCount = INITIAL_VISIBLE;
    if (cat !== "all") {
      isLoadingCategory = true;
      if (loadMoreBtn) {
        loadMoreBtn.textContent = "Loading…";
        loadMoreBtn.style.display = "inline-flex";
      }
      await loadCategory(cat);
      isLoadingCategory = false;
      if (loadMoreBtn) loadMoreBtn.textContent = "Load More Videos";
    }
    renderGrid();
  }

  function renderChips() {
    if (!chips) return;
    chips.innerHTML = "";
    const all = document.createElement("button");
    all.className = "chip active";
    all.textContent = "All";
    all.dataset.cat = "all";
    chips.appendChild(all);

    const cats = (typeof CATEGORIES !== "undefined" && CATEGORIES.length)
      ? CATEGORIES
      : [...new Set(VIDEOS.map(v => v.category))].sort();

    cats.forEach(cat => {
      const btn = document.createElement("button");
      btn.className = "chip";
      btn.textContent = cat;
      btn.dataset.cat = cat;
      chips.appendChild(btn);
    });

    chips.addEventListener("click", async (e) => {
      if (!e.target.classList.contains("chip")) return;
      chips.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      e.target.classList.add("active");
      await selectCategory(e.target.dataset.cat);
    });
  }

  // Sort buttons
  document.querySelectorAll(".sort-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".sort-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentSort = btn.dataset.sort;
      visibleCount = INITIAL_VISIBLE;
      renderGrid();
    });
  });

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", async () => {
      if (isLoadingCategory) return;
      visibleCount += LOAD_MORE_STEP;
      // If filtering a category, try to ensure it's fully loaded
      if (currentFilter !== "all") await loadCategory(currentFilter);
      renderGrid();
    });
  }

  // Search
  const searchForm = document.getElementById("search-form");
  if (searchForm) {
    searchForm.addEventListener("submit", e => {
      e.preventDefault();
      const q = (document.getElementById("search-input")?.value || "").trim().toLowerCase();
      if (!q) {
        currentFilter = "all";
        renderGrid();
        return;
      }
      const results = VIDEOS.filter(v =>
        (v.title && v.title.toLowerCase().includes(q)) ||
        (v.tags && v.tags.some(t => t.includes(q))) ||
        (v.category && v.category.toLowerCase().includes(q)) ||
        (v.performer && v.performer.toLowerCase().includes(q))
      );
      if (grid) {
        grid.innerHTML = "";
        results.slice(0, 120).forEach(v => grid.appendChild(createCard(v)));
        if (sectionTitle) sectionTitle.textContent = `Search: “${q}” (${results.length})`;
        if (loadMoreBtn) loadMoreBtn.style.display = "none";
      }
    });
  }

  // Init home
  if (grid) {
    renderChips();
    const params = new URLSearchParams(window.location.search);
    const catParam = params.get("cat");
    const qParam = params.get("q");

    if (catParam) {
      const chip = document.querySelector(`.chip[data-cat="${CSS.escape(catParam)}"]`);
      if (chip) {
        document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
      }
      selectCategory(catParam);
    } else if (qParam) {
      const input = document.getElementById("search-input");
      if (input) input.value = qParam;
      const results = VIDEOS.filter(v =>
        (v.title && v.title.toLowerCase().includes(qParam.toLowerCase())) ||
        (v.tags && v.tags.some(t => t.includes(qParam.toLowerCase()))) ||
        (v.category && v.category.toLowerCase().includes(qParam.toLowerCase()))
      );
      grid.innerHTML = "";
      results.slice(0, 120).forEach(v => grid.appendChild(createCard(v)));
      if (sectionTitle) sectionTitle.textContent = `Search: “${qParam}” (${results.length})`;
      if (loadMoreBtn) loadMoreBtn.style.display = "none";
    } else {
      renderGrid();
    }
  }

  // ---------- Video Player Page ----------
  if (window.location.pathname.includes("video.html") || document.getElementById("player-root")) {
    initPlayerPage();
  }

  async function initPlayerPage() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    let video = (typeof VIDEOS !== "undefined") ? VIDEOS.find(v => v.id === id) : null;

    // If not in featured set, try to find it by loading a few popular categories
    // (simple fallback — full search would need an index)
    if (!video && id) {
      // Best effort: video might be in featured already
      video = VIDEOS[0];
    }
    if (!video) return;

    document.title = `${video.title} | NexusXXX Free HD Porn`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.content = `Watch ${video.title} free in HD. ${video.category} porn video - ${video.duration}.`;

    // Schema.org VideoObject
    const schema = {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      "name": video.title,
      "description": `Free HD ${video.category} porn video: ${video.title}`,
      "thumbnailUrl": video.thumb,
      "uploadDate": video.added || "2024-01-01",
      "duration": (function (d) {
        const p = String(d).split(":").map(Number);
        if (p.length === 3) return `PT${p[0]}H${p[1]}M${p[2]}S`;
        if (p.length === 2) return `PT${p[0]}M${p[1]}S`;
        return `PT${d}S`;
      })(video.duration),
      "contentUrl": video.embedSrc,
      "embedUrl": video.embedSrc,
      "interactionStatistic": {
        "@type": "InteractionCounter",
        "interactionType": { "@type": "WatchAction" },
        "userInteractionCount": video.views
      }
    };
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    const playerWrap = document.getElementById("player-iframe");
    if (playerWrap) {
      playerWrap.innerHTML = `<iframe src="${video.embedSrc}" allowfullscreen allow="autoplay; fullscreen; picture-in-picture" loading="lazy" title="${escapeHtml(video.title)}"></iframe>`;
    }

    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    setText("video-title", video.title);
    setText("video-views", formatViews(video.views) + " views");
    setText("video-duration", video.duration);
    setText("video-category", video.category);
    setText("video-source", "Source: " + (video.source || "Pornhub"));

    const tagsEl = document.getElementById("video-tags");
    if (tagsEl && video.tags) {
      tagsEl.innerHTML = video.tags.map(t =>
        `<a class="tag" href="../index.html?q=${encodeURIComponent(t)}">${escapeHtml(t)}</a>`
      ).join("");
    }

    // Share
    const shareUrl = window.location.href;
    const shareTitle = video.title + " - NexusXXX";

    const shareNative = document.getElementById("share-native");
    if (shareNative && navigator.share) {
      shareNative.style.display = "inline-flex";
      shareNative.addEventListener("click", async () => {
        try {
          await navigator.share({ title: shareTitle, url: shareUrl, text: "Watch this free HD video" });
        } catch (err) { /* cancelled */ }
      });
    }

    const shareCopy = document.getElementById("share-copy");
    if (shareCopy) {
      shareCopy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(shareUrl);
          shareCopy.textContent = "Copied!";
          setTimeout(() => { shareCopy.innerHTML = "📋 Copy Link"; }, 2000);
        } catch {
          prompt("Copy this link:", shareUrl);
        }
      });
    }

    // Related
    const related = document.getElementById("related-list");
    if (related) {
      // Prefer same category
      await loadCategory(video.category);
      const sameCat = VIDEOS.filter(v => v.id !== video.id && v.category === video.category)
        .sort((a, b) => b.views - a.views)
        .slice(0, 8);
      const list = sameCat.length >= 4
        ? sameCat
        : VIDEOS.filter(v => v.id !== video.id).sort((a, b) => b.views - a.views).slice(0, 8);

      related.innerHTML = list.map(v => `
        <a class="related-item" href="video.html?id=${v.id}">
          <img class="related-thumb" src="${v.thumb}" alt="" loading="lazy" onerror="this.style.display='none'">
          <div class="related-info">
            <h4>${escapeHtml(v.title)}</h4>
            <span>${v.duration} • ${formatViews(v.views)}</span>
          </div>
        </a>
      `).join("");
    }
  }


  // ---------- Trending strip ----------
  const trendStrip = document.getElementById("trending-strip");
  if (trendStrip && typeof CATEGORIES !== "undefined") {
    const top = CATEGORIES.slice(0, 12);
    top.forEach(cat => {
      const a = document.createElement("a");
      a.className = "trend-tag";
      a.href = (window.location.pathname.includes("/pages/") ? "../index.html" : "index.html") + "?cat=" + encodeURIComponent(cat);
      a.textContent = cat;
      trendStrip.appendChild(a);
    });
  }

  // ---------- Footer category links ----------
  const footerCats = document.getElementById("footer-cats");
  if (footerCats && typeof CATEGORIES !== "undefined") {
    CATEGORIES.slice(0, 16).forEach(cat => {
      const a = document.createElement("a");
      a.href = (window.location.pathname.includes("/pages/") ? "../index.html" : "index.html") + "?cat=" + encodeURIComponent(cat);
      a.textContent = cat;
      footerCats.appendChild(a);
    });
  }

  // ---------- Mobile search ----------
  const mobileSearch = document.getElementById("mobile-search-form");
  if (mobileSearch) {
    mobileSearch.addEventListener("submit", e => {
      e.preventDefault();
      const q = (document.getElementById("mobile-search-input")?.value || "").trim();
      if (q) {
        const base = window.location.pathname.includes("/pages/") ? "../index.html" : "index.html";
        window.location.href = base + "?q=" + encodeURIComponent(q);
      }
    });
  }

  // ---------- Page-aware default sort ----------
  if (window.location.pathname.includes("popular.html")) {
    currentSort = "popular";
  } else if (window.location.pathname.includes("newest.html")) {
    currentSort = "newest";
  }

  // Public API
  window.NexusXXX = {
    VIDEOS,
    CATEGORIES: typeof CATEGORIES !== "undefined" ? CATEGORIES : [],
    formatViews,
    loadCategory,
    version: "2.0-split"
  };
})();
