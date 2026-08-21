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
  const playTriangle = React.createElement("div", {
    style: {
      width: 0,
      height: 0,
      borderStyle: "solid",
      borderWidth: "20px 0 20px 36px",
      borderColor: "transparent transparent transparent #fff",
      marginLeft: 8,
    },
  });
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

export default async (request: Request, context: { next: () => Promise<Response> }) => {
  const requestUrl = new URL(request.url);
  const target = imageUrl(requestUrl.searchParams.get("url"));
  if (!target) return new Response("Invalid preview image", { status: 400 });

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      headers: {
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        referer: "https://nexusxxx.site/",
        "user-agent": "Mozilla/5.0 (compatible; NexusXXXPreview/2.0; +https://nexusxxx.site/)",
      },
    });
  } catch (_) {
    return new Response("Preview image unavailable", { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return new Response("Preview image unavailable", {
      status: upstream.status || 502,
      headers: { "cache-control": "public, max-age=60" },
    });
  }

  const contentType = (upstream.headers.get("content-type") || "image/jpeg").split(";", 1)[0];
  if (!/^image\//i.test(contentType)) return new Response("Preview image unavailable", { status: 502 });

  let bytes = new Uint8Array();
  try {
    bytes = new Uint8Array(await upstream.arrayBuffer());
    const source = `data:${contentType};base64,${toBase64(bytes)}`;
    const generated = playPreview(source);
    const headers = new Headers(generated.headers);
    headers.set("content-type", "image/png");
    headers.set("cache-control", "public, max-age=31536000, immutable");
    headers.set("access-control-allow-origin", "*");
    headers.set("x-content-type-options", "nosniff");
    headers.set("x-nexus-preview-image", "png-play-overlay-v3");
    return new Response(generated.body, { status: 200, headers });
  } catch (_) {
    // Preserve a usable exact thumbnail if an upstream format cannot be decoded
    // by the edge rasterizer; the metadata still remains crawler-safe.
    return bytes.length ? rawResponse(bytes, contentType) : new Response("Preview image unavailable", { status: 502 });
  }
};

export const config = { path: "/preview-image" };
