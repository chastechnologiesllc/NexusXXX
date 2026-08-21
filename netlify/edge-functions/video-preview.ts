const SITE_NAME = "NexusXXX";
const SITE_ORIGIN = "https://nexusxxx.site";
const IMAGE_RE = /^https?:\/\/[^\s"'<>]+\.(?:jpe?g|png|webp|gif)(?:[/?#].*)?$/i;
const CATALOG_RE = /^[a-z0-9-]+\/part-\d{4}\.json$/i;
const EMBED_ID_RE = /^[a-zA-Z0-9]+$/;

// This keeps the legacy link shown in the reported WhatsApp screenshot exact
// while all new share buttons emit locator-aware URLs.
const LEGACY_LOCATORS: Record<string, { catalog: string; record: number }> = {
  ph5e6d9d48d0bbf: { catalog: "brazilian/part-0001.json", record: 92 },
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
  const title = `${titleRaw} | ${SITE_NAME}`;
  const descriptionRaw = `Watch "${titleRaw}" on ${SITE_NAME}. Category: ${categoryRaw}. Views: ${formatViews(views)}. Duration: ${duration || "Not listed"}.${tags.length ? ` Tags: ${tags.join(", ")}.` : ""}`;
  const embed = safeEmbed(id);
  const imageTags = images.map(image => `  <meta property="og:image" content="${escapeHtml(image)}">`).join("\n");
  const imageStructured = images.length ? [
    `  <meta property="og:image:url" content="${escapeHtml(images[0])}">`,
    `  <meta property="og:image:secure_url" content="${escapeHtml(images[0])}">`,
    `  <meta property="og:image:type" content="image/jpeg">`,
    `  <meta property="og:image:width" content="320">`,
    `  <meta property="og:image:height" content="240">`,
    `  <meta property="og:image:alt" content="${escapeHtml(titleRaw)} video preview">`,
  ].join("\n") : "";
  const twitterImage = images.length ? [
    `  <meta name="twitter:image" content="${escapeHtml(images[0])}">`,
    `  <meta name="twitter:image:alt" content="${escapeHtml(titleRaw)} video preview">`,
  ].join("\n") : "";
  const seconds = durationSeconds(duration);
  const isoDuration = durationIso(duration);
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: titleRaw,
    description: descriptionRaw,
    thumbnailUrl: images,
    embedUrl: embed,
    url: canonical,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
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
  if (!images.length) delete schema.thumbnailUrl;
  const jsonLd = JSON.stringify(schema).replace(/<\//g, "<\\/");
  const durationTag = seconds > 0 ? `\n  <meta property="og:video:duration" content="${seconds}">` : "";
  return [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(descriptionRaw)}">`,
    `<meta name="robots" content="noindex, follow">`,
    `<link rel="canonical" href="${escapeHtml(canonical)}">`,
    `<meta property="og:site_name" content="${SITE_NAME}">`,
    `<meta property="og:type" content="video.other">`,
    `<meta property="og:url" content="${escapeHtml(canonical)}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(descriptionRaw)}">`,
    `<meta property="article:section" content="${escapeHtml(categoryRaw)}">`,
    `<meta name="keywords" content="${escapeHtml([categoryRaw, ...tags].join(", "))}">`,
    imageTags,
    imageStructured,
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

async function loadVideo(request: Request, url: URL): Promise<Record<string, unknown> | null> {
  const id = String(url.searchParams.get("id") || "").trim();
  if (!EMBED_ID_RE.test(id)) return null;
  let catalog = String(url.searchParams.get("catalog") || "").replace(/^\/+/, "");
  let record = Number(url.searchParams.get("record"));
  const legacy = LEGACY_LOCATORS[id];
  if ((!catalog || !Number.isInteger(record) || record < 0) && legacy) {
    catalog = legacy.catalog;
    record = legacy.record;
  }
  if (!CATALOG_RE.test(catalog)) return null;
  if (url.searchParams.has("record") && (!Number.isInteger(record) || record < 0 || record > 5000)) return null;
  const catalogUrl = new URL(`/js/catalog/${catalog}`, request.url);
  const response = await fetch(catalogUrl, { headers: { accept: "application/json" } });
  if (!response.ok) return null;
  const payload = await response.json();
  const videos = Array.isArray(payload?.videos) ? payload.videos : [];
  const video = Number.isInteger(record) && record >= 0 ? videos[record] : videos.find((candidate: unknown) => String((candidate as Record<string, unknown>)?.id || "") === id);
  if (!video || String(video.id) !== id) return null;
  return video as Record<string, unknown>;
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
  const url = new URL(request.url);
  const video = await loadVideo(request, url);
  if (!video) return context.next();
  const id = String(video.id);
  const locator = LEGACY_LOCATORS[id] || {
    catalog: String(url.searchParams.get("catalog") || ""),
    record: Number(url.searchParams.get("record")),
  };
  video.catalogFile = locator.catalog;
  video.catalogIndex = locator.record;
  const canonicalParams = new URLSearchParams({ id, catalog: locator.catalog });
  if (Number.isInteger(locator.record) && locator.record >= 0) canonicalParams.set("record", String(locator.record));
  const canonical = `${SITE_ORIGIN}/pages/video.html?${canonicalParams.toString()}`;
  const templateResponse = await context.next();
  if (!templateResponse.ok) return templateResponse;
  const template = stripTemplateMetadata(await templateResponse.text());
  const bootJson = JSON.stringify(video).replace(/</g, "\\u003c");
  const bootScript = `<script>window.__NEXUS_STATIC_VIDEO=${bootJson};</script>`;
  const html = template.replace("</head>", `${buildMetadata(video, canonical)}\n${bootScript}\n</head>`);
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=UTF-8",
      "cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      "x-nexus-preview": "edge-exact-video-metadata",
    },
  });
};

export const config = { path: "/pages/video.html" };
