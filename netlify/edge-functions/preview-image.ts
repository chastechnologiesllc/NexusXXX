const SITE_ORIGIN = "https://nexusxxx.site";
const ALLOWED_HOSTS = new Set([
  "ei.phncdn.com",
  "pix-fl.phncdn.com",
  "ci.phncdn.com",
  "img-hw.xvideos-cdn.com",
]);

function imageUrl(value: string | null): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return null;
    return url;
  } catch (_) {
    return null;
  }
}

export default async (request: Request, context: { next: () => Promise<Response> }) => {
  const requestUrl = new URL(request.url);
  const target = imageUrl(requestUrl.searchParams.get("url"));
  if (!target) {
    return new Response("Invalid preview image", { status: 400 });
  }

  const upstream = await fetch(target, {
    headers: {
      accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      referer: `${SITE_ORIGIN}/`,
      "user-agent": "Mozilla/5.0 (compatible; NexusXXXPreview/1.0; +https://nexusxxx.site/)",
    },
  });
  if (!upstream.ok || !upstream.body) {
    return new Response("Preview image unavailable", {
      status: upstream.status || 502,
      headers: { "cache-control": "public, max-age=60" },
    });
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type") || "image/jpeg";
  if (!/^image\//i.test(contentType)) {
    return new Response("Preview image unavailable", { status: 502 });
  }
  headers.set("content-type", contentType.split(";", 1)[0]);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("access-control-allow-origin", "*");
  headers.set("x-content-type-options", "nosniff");
  return new Response(upstream.body, { status: 200, headers });
};

export const config = { path: "/preview-image" };
