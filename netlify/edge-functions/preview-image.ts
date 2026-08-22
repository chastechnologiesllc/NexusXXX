import { ImageResponse } from "https://deno.land/x/og_edge/mod.ts";
import React from "https://esm.sh/react@18.2.0";

const ALLOWED_HOSTS = new Set([
  "ei.phncdn.com",
  "pix-fl.phncdn.com",
  "ci.phncdn.com",
  "img-hw.xvideos-cdn.com",
]);
const WIDTH = 640;
const HEIGHT = 480;
const UPSTREAM_TIMEOUT_MS = 6000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

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

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const step = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += step) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + step));
  }
  return btoa(binary);
}

function rawResponse(body: BodyInit, contentType: string, status = 200): Response {
  const headers = new Headers({
    "content-type": contentType,
    "cache-control": "public, max-age=31536000, immutable",
    "access-control-allow-origin": "*",
    "x-content-type-options": "nosniff",
  });
  return new Response(body, { status, headers });
}

function unavailableResponse(status = 502): Response {
  return new Response("Preview image temporarily unavailable. Please refresh and try again.", {
    status,
    headers: {
      "content-type": "text/plain; charset=UTF-8",
      "cache-control": "public, max-age=60",
      "access-control-allow-origin": "*",
      "x-content-type-options": "nosniff",
      "retry-after": "30",
    },
  });
}

async function readBytesWithLimit(body: ReadableStream<Uint8Array>, limit: number): Promise<Uint8Array> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new Error("preview image exceeds size limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function fetchImageWithTimeout(target: URL): Promise<{ response: Response; bytes: Uint8Array } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(target, {
      headers: {
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        referer: "https://nexusxxx.site/",
        "user-agent": "Mozilla/5.0 (compatible; NexusXXXPreview/2.0; +https://nexusxxx.site/)",
      },
      signal: controller.signal,
    });
    if (!response.ok || !response.body) return { response, bytes: new Uint8Array() };
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_IMAGE_BYTES) throw new Error("preview image exceeds size limit");
    return { response, bytes: await readBytesWithLimit(response.body, MAX_IMAGE_BYTES) };
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function playPreview(source: string): Response {
  const image = React.createElement("img", {
    src: source,
    width: WIDTH,
    height: HEIGHT,
    style: {
      position: "absolute",
      top: 0,
      left: 0,
      width: WIDTH,
      height: HEIGHT,
      objectFit: "cover",
    },
  });
  const playTriangle = React.createElement(
    "svg",
    { width: 36, height: 40, viewBox: "0 0 36 40", style: { marginLeft: 8 } },
    React.createElement("polygon", { points: "0,0 36,20 0,40", fill: "#fff" }),
  );
  const playButton = React.createElement(
    "div",
    {
      style: {
        width: 112,
        height: 112,
        borderRadius: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.55)",
        border: "4px solid rgba(255,255,255,0.85)",
      },
    },
    playTriangle,
  );
  const overlay = React.createElement(
    "div",
    {
      style: {
        position: "absolute",
        top: 0,
        left: 0,
        width: WIDTH,
        height: HEIGHT,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      },
    },
    playButton,
  );
  const root = React.createElement(
    "div",
    {
      style: {
        position: "relative",
        display: "flex",
        width: WIDTH,
        height: HEIGHT,
        overflow: "hidden",
        backgroundColor: "#111111",
      },
    },
    image,
    overlay,
  );
  return new ImageResponse(root, { width: WIDTH, height: HEIGHT });
}

export default async (request: Request, _context: { next: () => Promise<Response> }) => {
  try {
    const requestUrl = new URL(request.url);
    const target = imageUrl(requestUrl.searchParams.get("url"));
    if (!target) return new Response("Invalid preview image", { status: 400, headers: { "cache-control": "public, max-age=60" } });

    const result = await fetchImageWithTimeout(target);
    if (!result) return unavailableResponse();
    const upstream = result.response;
    if (!upstream.ok || !result.bytes.length) {
      return unavailableResponse(upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502);
    }

    const contentType = (upstream.headers.get("content-type") || "image/jpeg").split(";", 1)[0];
    if (!/^image\//i.test(contentType)) return unavailableResponse(502);

    const bytes = result.bytes;
    try {
      const source = `data:${contentType};base64,${toBase64(bytes)}`;
      const generated = playPreview(source);
      const headers = new Headers(generated.headers);
      headers.set("content-type", "image/png");
      headers.set("cache-control", "public, max-age=31536000, immutable");
      headers.set("access-control-allow-origin", "*");
      headers.set("x-content-type-options", "nosniff");
      headers.set("x-nexus-preview-image", "png-play-overlay-v4");
      return new Response(generated.body, { status: 200, headers });
    } catch (_) {
      // Preserve a usable exact thumbnail if an upstream format cannot be decoded
      // by the edge rasterizer; the metadata still remains crawler-safe.
      return rawResponse(bytes, contentType);
    }
  } catch (error) {
    console.error("preview-image failed safely", error instanceof Error ? error.message : String(error));
    return unavailableResponse();
  }
};

export const config = { path: "/preview-image", onError: "bypass" };
