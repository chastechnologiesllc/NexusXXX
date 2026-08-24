const SITE_NAME = "NexusXXX";
const SITE_ORIGIN = "https://nexusxxx.site";
const IMAGE_RE = /^https?:\/\/[^\s"'<>]+\.(?:jpe?g|png|webp|gif)(?:[/?#].*)?$/i;

function previewImageUrl(image: string): string {
  return `${SITE_ORIGIN}/preview-image?url=${encodeURIComponent(image)}&v=play4`;
}
const CATALOG_RE = /^[a-z0-9-]+\/part-\d{4}\.json$/i;
const EMBED_ID_RE = /^[a-zA-Z0-9]+$/;
const UPSTREAM_TIMEOUT_MS = 2500;
const LOOKUP_BUDGET_MS = 6500;
const ORIGIN_TIMEOUT_MS = 8000;
const LOCATOR_BUCKET_COUNT = 1024;

function remainingBudget(deadline: number): number {
  return Math.max(1, Math.min(UPSTREAM_TIMEOUT_MS, deadline - Date.now()));
}

async function fetchBodyWithTimeout<T>(
  input: string | URL | Request,
  init: RequestInit,
  timeoutMs: number,
  readBody: (response: Response) => Promise<T>,
): Promise<{ response: Response; body: T } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const body = await readBody(response);
    return { response, body };
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function unavailableResponse(status = 503): Response {
  return new Response("NexusXXX is temporarily unavailable. Please refresh and try again.", {
    status,
    headers: {
      "content-type": "text/plain; charset=UTF-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "retry-after": "30",
    },
  });
}

async function continueSafely(context: { next: () => Promise<Response> }): Promise<Response> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>(resolve => {
    timer = setTimeout(() => resolve(null), ORIGIN_TIMEOUT_MS);
  });
  try {
    const result = await Promise.race([
      context.next().catch(error => {
        console.error("video-preview origin failed", error instanceof Error ? error.message : String(error));
        return null;
      }),
      timeout,
    ]);
    return result || unavailableResponse();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// This keeps the legacy link shown in the reported WhatsApp screenshot exact
// while all new share buttons emit locator-aware URLs.
const LEGACY_LOCATORS: Record<string, { catalog: string; record: number }> = {
  ph5e6d9d48d0bbf: { catalog: "brazilian/part-0001.json", record: 92 },
  // Migration for links generated before exact shard/index locators were added.
  ph620e3cc21d653: { catalog: "amateur/part-0029.json", record: 14632 },
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function validImage(value: unknown): string {
  const image = String(value ?? "").trim();
  return IMAGE_RE.test(image) ? image : "";
}

function decodeVideoMeta(value: string | null, id: string): Record<string, unknown> | null {
  const encoded = String(value || "");
  if (!encoded || encoded.length > 3600 || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
  try {
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - encoded.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || String(parsed.id || "") !== id || !String(parsed.title || "").trim()) return null;
    const thumb = validImage(parsed.thumb);
    if (!thumb) return null;
    return {
      id,
      title: String(parsed.title).trim().slice(0, 240),
      category: String(parsed.category || "Adult Videos").trim().slice(0, 80) || "Adult Videos",
      duration: String(parsed.duration || "").trim().slice(0, 20),
      views: Number(parsed.views) || 0,
      thumb,
      thumbFallback: validImage(parsed.thumbFallback),
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(tag => String(tag).trim().slice(0, 80)).filter(Boolean).slice(0, 12) : [],
      embedSrc: `https://www.pornhub.com/embed/${id}`,
      __metaOnly: true,
    };
  } catch (_) {
    return null;
  }
}

function durationSeconds(value: unknown): number {
  const parts = String(value ?? "").split(":").map(Number);
  if (parts.some(part => !Number.isFinite(part) || part < 0)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function durationIso(value: unknown): string | undefined {
  const seconds = durationSeconds(value);
  return seconds > 0 ? `PT${seconds}S` : undefined;
}

function formatViews(value: unknown): string {
  const views = Number(value) || 0;
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
  return String(views);
}

function safeEmbed(id: string): string {
  return `https://www.pornhub.com/embed/${id}`;
}

function slugify(value: unknown): string {
  const normalized = String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "video";
}

function cleanVideoPath(video: Record<string, unknown>): string {
  const id = String(video.id ?? "").replace(/[^a-zA-Z0-9]+/g, "").toLowerCase();
  return `${SITE_ORIGIN}/watch/${slugify(video.title).slice(0, 90)}-${id}.html`;
}

function locatorBucketFor(id: string): string {
  let value = 2166136261;
  for (const char of id.toLowerCase()) {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 16777619) >>> 0;
  }
  return (value & (LOCATOR_BUCKET_COUNT - 1)).toString(16).padStart(3, "0");
}

function idFromRequestUrl(url: URL): string {
  const queryId = String(url.searchParams.get("id") || "").trim();
  if (queryId) return queryId;
  const match = url.pathname.match(/^\/watch\/[a-z0-9-]+-([a-zA-Z0-9]+)\.html$/i);
  return match ? match[1] : "";
}

async function loadVideoAtLocator(
  request: Request,
  catalog: string,
  record: number,
  deadline: number,
): Promise<Record<string, unknown> | null> {
  if (!CATALOG_RE.test(catalog) || !Number.isInteger(record) || record < 0 || record > 5000 || Date.now() >= deadline) return null;
  const result = await fetchBodyWithTimeout(
    new URL(`/js/catalog/${catalog}`, request.url),
    { headers: { accept: "application/json" } },
    remainingBudget(deadline),
    response => response.json(),
  );
  if (!result?.response.ok) return null;
  const videos = Array.isArray(result.body?.videos) ? result.body.videos : [];
  const video = videos[record];
  return video && typeof video === "object" ? video as Record<string, unknown> : null;
}

async function loadVideoByLocatorIndex(
  request: Request,
  id: string,
  deadline: number,
): Promise<Record<string, unknown> | null> {
  if (Date.now() >= deadline) return null;
  const result = await fetchBodyWithTimeout(
    new URL(`/js/catalog/locator-index/${locatorBucketFor(id)}.txt`, request.url),
    { headers: { accept: "text/plain" } },
    remainingBudget(deadline),
    response => response.text(),
  );
  if (!result?.response.ok) return null;
  for (const line of result.body.split(/\r?\n/)) {
    const [candidateId, catalog, rawRecord] = line.split("\t");
    if (candidateId !== id || !catalog) continue;
    const record = Number(rawRecord);
    return loadVideoAtLocator(request, catalog, record, deadline);
  }
  return null;
}

function buildVisibleSeo(video: Record<string, unknown>, canonical: string): string {
  const title = escapeHtml(String(video.title ?? "Video").trim() || "Video");
  const category = escapeHtml(String(video.category ?? "Adult Videos").trim() || "Adult Videos");
  const duration = escapeHtml(String(video.duration ?? "").trim() || "Not listed");
  const views = escapeHtml(formatViews(video.views));
  const tags = Array.isArray(video.tags)
    ? video.tags.map(tag => String(tag).trim()).filter(Boolean).slice(0, 12)
    : [];
  const tagText = tags.length ? ` Related topics: ${escapeHtml(tags.join(", "))}.` : "";
  return `<section class="seo-video-copy" aria-labelledby="seo-video-heading"><nav class="seo-breadcrumbs" aria-label="Breadcrumb"><a href="${SITE_ORIGIN}/">Home</a><span aria-hidden="true">›</span><a href="${SITE_ORIGIN}/pages/categories.html">Categories</a><span aria-hidden="true">›</span><span aria-current="page">${title}</span></nav><h2 id="seo-video-heading">${title}</h2><p>Watch this ${category.toLowerCase()} video on NexusXXX. The page includes the embedded player, related recommendations, and accurate video details.</p><p>Category: ${category}. Views: ${views}. Duration: ${duration}.${tagText}</p><p><a href="${escapeHtml(canonical)}">Open the canonical video page</a> or <a href="${SITE_ORIGIN}/pages/categories.html">browse all categories</a>.</p></section>`;
}

function buildMetadata(video: Record<string, unknown>, canonical: string): string {
  const id = String(video.id ?? "").trim();
  const titleRaw = String(video.title ?? "Video").trim() || "Video";
  const categoryRaw = String(video.category ?? "Adult Videos").trim() || "Adult Videos";
  const duration = String(video.duration ?? "").trim();
  const views = Number(video.views) || 0;
  const tags = Array.isArray(video.tags)
    ? video.tags.map(tag => String(tag).trim()).filter(Boolean).slice(0, 12)
    : [];
  const images = [...new Set([validImage(video.thumb), validImage(video.thumbFallback)].filter(Boolean))].slice(0, 2);
  const previewImages = images.map(previewImageUrl);
  const title = `${titleRaw} | ${SITE_NAME}`;
  const pageTitle = `${titleRaw} — ${id} | ${SITE_NAME}`;
  const descriptionRaw = `Watch "${titleRaw}" on ${SITE_NAME}. Category: ${categoryRaw}. Views: ${formatViews(views)}. Duration: ${duration || "Not listed"}.${tags.length ? ` Tags: ${tags.join(", ")}.` : ""}`;
  const embed = safeEmbed(id);
  const imageMarkup = previewImages.map((image, index) => [
    `  <meta property="og:image" content="${escapeHtml(image)}">`,
    `  <meta property="og:image:url" content="${escapeHtml(image)}">`,
    `  <meta property="og:image:secure_url" content="${escapeHtml(image)}">`,
    `  <meta property="og:image:type" content="image/png">`,
    `  <meta property="og:image:width" content="640">`,
    `  <meta property="og:image:height" content="480">`,
    `  <meta property="og:image:alt" content="${escapeHtml(titleRaw)} video thumbnail with play button${index ? ` ${index + 1}` : ""}">`,
  ].join("\n")).join("\n");
  const twitterImage = previewImages.length ? [
    `  <meta name="twitter:image" content="${escapeHtml(previewImages[0])}">`,
    `  <meta name="twitter:image:alt" content="${escapeHtml(titleRaw)} video thumbnail with play button">`,
  ].join("\n") : "";
  const seconds = durationSeconds(duration);
  const isoDuration = durationIso(duration);
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: titleRaw,
    description: descriptionRaw,
    thumbnailUrl: previewImages,
    embedUrl: embed,
    url: canonical,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    image: previewImages,
    potentialAction: { "@type": "WatchAction", "target": canonical },
    dateModified: /^\\d{4}-\\d{2}-\\d{2}$/.test(String(video.added || "")) ? String(video.added) : undefined,
    isFamilyFriendly: false,
    inLanguage: "en",
    genre: categoryRaw,
    keywords: tags,
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_ORIGIN },
    interactionStatistic: {
      "@type": "InteractionCounter",
      interactionType: { "@type": "WatchAction" },
      userInteractionCount: views,
    },
  };
  if (isoDuration) schema.duration = isoDuration;
  if (!previewImages.length) delete schema.thumbnailUrl;
  const jsonLd = JSON.stringify(schema).replace(/<\//g, "<\\/");
  const durationTag = seconds > 0 ? `\n  <meta property="og:video:duration" content="${seconds}">` : "";
  return [
    `<title>${escapeHtml(pageTitle)}</title>`,
    `<meta name="description" content="${escapeHtml(descriptionRaw)}">`,
    `<meta name="robots" content="index, follow">`,
    `<link rel="canonical" href="${escapeHtml(canonical)}">`,
    `<meta property="og:site_name" content="${SITE_NAME}">`,
    `<meta property="og:type" content="video.other">`,
    `<meta property="og:url" content="${escapeHtml(canonical)}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(descriptionRaw)}">`,
    `<meta property="article:section" content="${escapeHtml(categoryRaw)}">`,
    `<meta name="keywords" content="${escapeHtml([categoryRaw, ...tags].join(", "))}">`,
    imageMarkup,
    `  <meta property="og:video" content="${escapeHtml(embed)}">`,
    `  <meta property="og:video:type" content="text/html">`,
    `  <meta property="og:video:secure_url" content="${escapeHtml(embed)}">`,
    `  <meta property="og:video:width" content="1280">`,
    `  <meta property="og:video:height" content="720">${durationTag}`,
    `  <meta name="twitter:card" content="summary_large_image">`,
    `  <meta name="twitter:title" content="${escapeHtml(title)}">`,
    `  <meta name="twitter:description" content="${escapeHtml(descriptionRaw)}">`,
    `  <meta name="twitter:player" content="${escapeHtml(canonical)}">`,
    `  <meta name="twitter:player:width" content="1280">`,
    `  <meta name="twitter:player:height" content="720">`,
    twitterImage,
    `  <script type="application/ld+json">${jsonLd}</script>`,
  ].filter(Boolean).join("\n");
}

async function loadVideoByPublicIndexes(
  request: Request,
  id: string,
  deadline: number,
): Promise<Record<string, unknown> | null> {
  if (Date.now() >= deadline) return null;
  const headers = { accept: "application/javascript, application/json" };
  try {
    const featuredResult = await fetchBodyWithTimeout(
      new URL("/js/data.js", request.url),
      { headers },
      remainingBudget(deadline),
      response => response.text(),
    );
    if (featuredResult?.response.ok) {
      const match = featuredResult.body.match(/const VIDEOS\s*=\s*(\[.*?\]);\s*const CATEGORIES/s);
      if (match) {
        try {
          const videos = JSON.parse(match[1]);
          const featured = Array.isArray(videos)
            ? videos.find((candidate: unknown) => String((candidate as Record<string, unknown>)?.id || "") === id)
            : null;
          if (featured) return featured as Record<string, unknown>;
        } catch (_) {}
      }
    }
  } catch (_) {}

  if (Date.now() >= deadline) return null;
  try {
    const relatedResult = await fetchBodyWithTimeout(
      new URL("/js/catalog/related.json", request.url),
      { headers: { accept: "application/json" } },
      remainingBudget(deadline),
      response => response.json(),
    );
    if (!relatedResult?.response.ok) return null;
    const payload = relatedResult.body;
    const categories = payload?.categories && typeof payload.categories === "object" ? Object.values(payload.categories) : [];
    for (const category of categories) {
      const videos = Array.isArray((category as Record<string, unknown>)?.videos) ? (category as Record<string, unknown>).videos as unknown[] : [];
      const found = videos.find((candidate: unknown) => String((candidate as Record<string, unknown>)?.id || "") === id);
      if (found) return found as Record<string, unknown>;
    }
  } catch (_) {}
  return null;
}

async function loadVideo(
  request: Request,
  url: URL,
  deadline: number,
): Promise<Record<string, unknown> | null> {
  const id = idFromRequestUrl(url);
  if (!EMBED_ID_RE.test(id)) return null;
  let catalog = String(url.searchParams.get("catalog") || "").replace(/^\/+/, "");
  const rawRecord = url.searchParams.get("record");
  let record = rawRecord === null || rawRecord.trim() === "" ? Number.NaN : Number(rawRecord);
  const legacy = LEGACY_LOCATORS[id];
  if (legacy && (catalog !== legacy.catalog || record !== legacy.record)) {
    catalog = legacy.catalog;
    record = legacy.record;
  }
  const embeddedMeta = () => decodeVideoMeta(url.searchParams.get("meta"), id);
  if (!catalog) return embeddedMeta() || loadVideoByLocatorIndex(request, id, deadline) || loadVideoByPublicIndexes(request, id, deadline);
  if (!CATALOG_RE.test(catalog)) return embeddedMeta();
  if (url.searchParams.has("record") && (!Number.isInteger(record) || record < 0 || record > 5000)) return null;

  try {
    const catalogUrl = new URL(`/js/catalog/${catalog}`, request.url);
    const result = await fetchBodyWithTimeout(
      catalogUrl,
      { headers: { accept: "application/json" } },
      remainingBudget(deadline),
      response => response.json(),
    );
    if (!result?.response.ok) return embeddedMeta() || loadVideoByPublicIndexes(request, id, deadline);
    const payload = result.body;
    const videos = Array.isArray(payload?.videos) ? payload.videos : [];
    const video = Number.isInteger(record) && record >= 0
      ? videos[record]
      : videos.find((candidate: unknown) => String((candidate as Record<string, unknown>)?.id || "") === id);
    if (video && String(video.id) === id) return video as Record<string, unknown>;
  } catch (_) {}

  // A stale locator must fail open quickly. Scanning a whole category’s shards
  // serially can exceed the Edge Function deadline and produce Netlify’s crash page.
  return embeddedMeta() || loadVideoByPublicIndexes(request, id, deadline);
}

function stripTemplateMetadata(template: string): string {
  return template
    .replace(/\s*<title>[\s\S]*?<\/title>/i, "")
    .replace(/\s*<meta\s+name="description"[^>]*>/gi, "")
    .replace(/\s*<meta\s+name="robots"[^>]*>/gi, "")
    .replace(/\s*<link\s+rel="canonical"[^>]*>/gi, "")
    .replace(/\s*<meta\s+(?:property|name)="(?:og:[^"]+|article:[^"]+|twitter:[^"]+|keywords)"[^>]*>/gi, "")
    .replace(/\s*<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/gi, "");
}

export default async (request: Request, context: { next: () => Promise<Response> }) => {
  const deadline = Date.now() + LOOKUP_BUDGET_MS;
  let templateResponse: Response | null = null;
  const templatePromise = continueSafely(context);
  try {
    const url = new URL(request.url);
    const video = await loadVideo(request, url, deadline);
    if (!video) return await templatePromise;
    const id = String(video.id);
    const metaOnly = video.__metaOnly === true;
    const inferredCatalog = metaOnly
      ? ""
      : String(video.catalogFile || video.__catalogFile || url.searchParams.get("catalog") || "").replace(/^\/+/, "");
    const inferredRecord = Number(video.catalogIndex ?? video.__catalogIndex ?? url.searchParams.get("record"));
    const locator = LEGACY_LOCATORS[id] || {
      catalog: inferredCatalog,
      record: inferredRecord,
    };
    video.catalogFile = locator.catalog;
    video.catalogIndex = locator.record;
    const watchUrl = String(video.watchUrl || "").replace(/^\/+/, "");
    const staticWatch = /^pages\/watch\/[a-z0-9-]+\.html$/i.test(watchUrl) ? watchUrl : "";
    const canonicalParams = new URLSearchParams({ id });
    if (locator.catalog) canonicalParams.set("catalog", locator.catalog);
    if (Number.isInteger(locator.record) && locator.record >= 0) canonicalParams.set("record", String(locator.record));
    if (metaOnly) canonicalParams.set("meta", String(url.searchParams.get("meta") || ""));
      const canonical = metaOnly
      ? `${SITE_ORIGIN}/pages/video.html?${canonicalParams.toString()}`
      : cleanVideoPath(video);
    templateResponse = await templatePromise;
    if (!templateResponse.ok) return templateResponse;
    const template = stripTemplateMetadata(await templateResponse.text());
    if (metaOnly) delete video.__metaOnly;
    const bootJson = JSON.stringify(video).replace(/</g, "\\u003c");
    const bootScript = `<script>window.__NEXUS_STATIC_VIDEO=${bootJson};</script>`;
    const seoCopy = buildVisibleSeo(video, canonical);
    const html = template
      .replace("</head>", `${buildMetadata(video, canonical)}\n${bootScript}\n</head>`)
      .replace('<div class="related-section">', `${seoCopy}\n<div class="related-section">`);
    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=UTF-8",
        "cache-control": "public, max-age=0, s-maxage=0, must-revalidate",
        "x-nexus-preview": "edge-exact-video-metadata",
        "x-nexus-preview-version": "share-play-overlay-7",
      },
    });
  } catch (error) {
    console.error("video-preview failed open", error instanceof Error ? error.message : String(error));
    // If the origin response already exists, preserve it rather than retrying
    // the chain. Otherwise a safe 503 is preferable to Netlify's crash page.
    return templateResponse || unavailableResponse();
  }
};

export const config = { path: ["/pages/video.html", "/watch/*"], onError: "bypass" };
