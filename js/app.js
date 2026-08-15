/**
 * NexusXXX Core Application Logic
 * Pure frontend - no backend required for demo
 */
(function () {
  "use strict";

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

  function createCard(video) {
    const card = document.createElement("article");
    card.className = "video-card";
    card.dataset.id = video.id;
    card.innerHTML = `
      <div class="thumb-wrap">
        <img src="${video.thumb}" alt="${escapeHtml(video.title)}" loading="lazy" width="640" height="360">
        <span class="duration">${video.duration}</span>
        <span class="quality-badge">HD</span>
      </div>
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(video.title)}</h3>
        <div class="card-meta">
          <span>${formatViews(video.views)} views</span>
          <span>${video.category}</span>
        </div>
      </div>
    `;
    card.addEventListener("click", () => {
      window.location.href = `pages/video.html?id=${encodeURIComponent(video.id)}`;
    });
    return card;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- Home / Grid Logic ----------
  const grid = document.getElementById("video-grid");
  const chips = document.getElementById("category-chips");
  const sectionTitle = document.getElementById("section-title");
  const loadMoreBtn = document.getElementById("load-more");
  let currentFilter = "all";
  let currentSort = "newest";
  let visibleCount = 8;

  function getFiltered() {
    let list = [...VIDEOS];
    if (currentFilter !== "all") {
      list = list.filter(v =>
        v.category === currentFilter ||
        v.tags.map(t => t.toLowerCase()).includes(currentFilter.toLowerCase())
      );
    }
    if (currentSort === "popular") {
      list.sort((a, b) => b.views - a.views);
    } else {
      list.sort((a, b) => new Date(b.added) - new Date(a.added));
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

  function renderChips() {
    if (!chips) return;
    chips.innerHTML = "";
    const all = document.createElement("button");
    all.className = "chip active";
    all.textContent = "All";
    all.dataset.cat = "all";
    chips.appendChild(all);

    CATEGORIES.forEach(cat => {
      const btn = document.createElement("button");
      btn.className = "chip";
      btn.textContent = cat;
      btn.dataset.cat = cat;
      chips.appendChild(btn);
    });

    chips.addEventListener("click", e => {
      if (e.target.classList.contains("chip")) {
        chips.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
        e.target.classList.add("active");
        currentFilter = e.target.dataset.cat;
        visibleCount = 8;
        renderGrid();
      }
    });
  }

  // Sort buttons
  document.querySelectorAll(".sort-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".sort-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentSort = btn.dataset.sort;
      visibleCount = 8;
      renderGrid();
    });
  });

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => {
      visibleCount += 8;
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
      // Simple client-side search
      const results = VIDEOS.filter(v =>
        v.title.toLowerCase().includes(q) ||
        v.tags.some(t => t.includes(q)) ||
        v.category.toLowerCase().includes(q)
      );
      if (grid) {
        grid.innerHTML = "";
        results.forEach(v => grid.appendChild(createCard(v)));
        if (sectionTitle) sectionTitle.textContent = `Search: “${q}” (${results.length})`;
        if (loadMoreBtn) loadMoreBtn.style.display = "none";
      }
    });
  }

  // Init home
  if (grid) {
    renderChips();
    // Support deep-links: ?cat=Asian or ?q=searchterm
    const params = new URLSearchParams(window.location.search);
    const catParam = params.get("cat");
    const qParam = params.get("q");
    if (catParam) {
      currentFilter = catParam;
      const chip = document.querySelector(`.chip[data-cat="${CSS.escape(catParam)}"]`);
      if (chip) {
        document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
      }
    }
    if (qParam) {
      const input = document.getElementById("search-input");
      if (input) input.value = qParam;
      // trigger search logic
      const results = VIDEOS.filter(v =>
        v.title.toLowerCase().includes(qParam.toLowerCase()) ||
        v.tags.some(t => t.includes(qParam.toLowerCase())) ||
        v.category.toLowerCase().includes(qParam.toLowerCase())
      );
      grid.innerHTML = "";
      results.forEach(v => grid.appendChild(createCard(v)));
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

  function initPlayerPage() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const video = VIDEOS.find(v => v.id === id) || VIDEOS[0];

    // Update title & meta
    document.title = `${video.title} | NexusXXX Free HD Porn`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.content = `Watch ${video.title} free in HD. ${video.category} porn video - ${video.duration}.`;

    // Inject schema
    const schema = {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      "name": video.title,
      "description": `Free HD ${video.category} porn video: ${video.title}`,
      "thumbnailUrl": video.thumb,
      "uploadDate": video.added,
      "duration": (function(d){ const p=d.split(":").map(Number); if(p.length===3) return `PT${p[0]}H${p[1]}M${p[2]}S`; if(p.length===2) return `PT${p[0]}M${p[1]}S`; return `PT${d}S`; })(video.duration),
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

    // Fill player
    const playerWrap = document.getElementById("player-iframe");
    if (playerWrap) {
      playerWrap.innerHTML = `<iframe src="${video.embedSrc}" allowfullscreen allow="autoplay; fullscreen; picture-in-picture" loading="lazy" title="${escapeHtml(video.title)}"></iframe>`;
    }

    const titleEl = document.getElementById("video-title");
    if (titleEl) titleEl.textContent = video.title;

    const viewsEl = document.getElementById("video-views");
    if (viewsEl) viewsEl.textContent = formatViews(video.views) + " views";

    const durEl = document.getElementById("video-duration");
    if (durEl) durEl.textContent = video.duration;

    const catEl = document.getElementById("video-category");
    if (catEl) catEl.textContent = video.category;

    const sourceEl = document.getElementById("video-source");
    if (sourceEl) sourceEl.textContent = "Source: " + video.source;

    // Tags
    const tagsEl = document.getElementById("video-tags");
    if (tagsEl) {
      tagsEl.innerHTML = video.tags.map(t => `<a class="tag" href="../index.html?q=${encodeURIComponent(t)}">${t}</a>`).join("");
    }

    // Share buttons
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
      const others = VIDEOS.filter(v => v.id !== video.id && (v.category === video.category || v.tags.some(t => video.tags.includes(t))))
        .slice(0, 6);
      const fallback = VIDEOS.filter(v => v.id !== video.id).slice(0, 6);
      const list = others.length ? others : fallback;
      related.innerHTML = list.map(v => `
        <a class="related-item" href="video.html?id=${v.id}">
          <img class="related-thumb" src="${v.thumb}" alt="" loading="lazy">
          <div class="related-info">
            <h4>${escapeHtml(v.title)}</h4>
            <span>${v.duration} • ${formatViews(v.views)}</span>
          </div>
        </a>
      `).join("");
    }
  }

  // ---------- Global Share helper (if needed on cards later) ----------
  window.NexusXXX = { VIDEOS, CATEGORIES, formatViews };
})();
