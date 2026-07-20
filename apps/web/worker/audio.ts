import allowlist from "./audio-allowlist.v1.json";

const SIGNED_URL_SECONDS = 10 * 60;
const MAX_FUTURE_SECONDS = 15 * 60;
const CACHE_SECONDS = 24 * 60 * 60;
const MAX_CACHEABLE_BYTES = 8 * 1024 * 1024;
const encoder = new TextEncoder();
const allowedHashes = {
  music: new Set(allowlist.music),
  sound: new Set(allowlist.sound),
};

export interface AudioEnv {
  AUDIO_BUCKET?: R2Bucket;
  AUDIO_SIGNING_SECRET?: string;
  AUDIO_ENABLED?: string;
  SIGN_RATE_LIMITER?: AudioRateLimiter;
  AUDIO_RATE_LIMITER?: AudioRateLimiter;
  AUDIO_CACHE?: Cache;
}

interface AudioRateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface AudioExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function isAudioEnabled(env: AudioEnv) {
  return env.AUDIO_ENABLED?.toLowerCase() !== "false";
}

function clientRateLimitKey(request: Request) {
  return request.headers.get("CF-Connecting-IP") ?? "unknown-client";
}

async function exceedsRateLimit(limiter: AudioRateLimiter | undefined, request: Request) {
  if (!limiter) return false;
  try {
    return !(await limiter.limit({ key: clientRateLimitKey(request) })).success;
  } catch {
    // A limiter outage must not make every audio request fail.
    return false;
  }
}

function rateLimitedResponse() {
  return new Response("Too Many Requests", {
    status: 429,
    headers: { "Cache-Control": "no-store", "Retry-After": "60" },
  });
}

function parseAudioKey(value: string | null) {
  if (!value || value.includes("\\") || value.includes("\0") || value.includes("%")) return null;
  const match = /^audio\/v1\/(music|sound)\/([a-f0-9]{2})\/([a-f0-9]{12})\.(opus|mp3)$/.exec(value);
  if (!match || match[2] !== match[3].slice(0, 2)) return null;
  const kind = match[1] as "music" | "sound";
  return allowedHashes[kind].has(match[3]) ? value : null;
}

function contentTypeForKey(key: string) {
  return key.endsWith(".mp3") ? "audio/mpeg" : "audio/ogg; codecs=opus";
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string) {
  if (!/^[a-f0-9]{64}$/.test(value)) return null;
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
}

async function sign(secret: string, key: string, expires: number) {
  return toHex(await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(`${key}\n${expires}`)));
}

async function verify(secret: string, key: string, expires: number, signature: string) {
  const bytes = fromHex(signature);
  if (!bytes) return false;
  return crypto.subtle.verify("HMAC", await hmacKey(secret), bytes, encoder.encode(`${key}\n${expires}`));
}

function validRangeSyntax(value: string | null) {
  return value === null || /^bytes=(?:\d+-\d*|-\d+)$/.test(value);
}

function resolveRange(value: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2]) || size < 1) return null;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix < 1) return null;
    const length = Math.min(suffix, size);
    return { offset: size - length, length };
  }
  const offset = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(requestedEnd) || offset >= size || requestedEnd < offset) return null;
  const end = Math.min(requestedEnd, size - 1);
  return { offset, length: end - offset + 1 };
}

function returnedRange(range: R2Range | undefined, size: number) {
  if (!range) return null;
  if ("offset" in range && typeof range.offset === "number") {
    const length = "length" in range && typeof range.length === "number" ? range.length : size - range.offset;
    return { offset: range.offset, length };
  }
  if ("suffix" in range && typeof range.suffix === "number") {
    const length = Math.min(range.suffix, size);
    return { offset: size - length, length };
  }
  return null;
}

function objectHeaders(object: R2Object, key: string, range: { offset: number; length: number } | null) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, max-age=3600");
  headers.set("Content-Type", contentTypeForKey(key));
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("ETag", object.httpEtag);
  headers.set("X-Content-Type-Options", "nosniff");
  if (range) {
    headers.set("Content-Length", String(range.length));
    headers.set("Content-Range", `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`);
  } else {
    headers.set("Content-Length", String(object.size));
  }
  return headers;
}

function visitorHeaders(source: Headers, cacheStatus: "HIT" | "MISS", range: { offset: number; length: number } | null, size: number) {
  const headers = new Headers(source);
  headers.set("Cache-Control", "private, max-age=3600");
  headers.set("X-Audio-Cache", cacheStatus);
  if (range) {
    headers.set("Content-Length", String(range.length));
    headers.set("Content-Range", `bytes ${range.offset}-${range.offset + range.length - 1}/${size}`);
  } else {
    headers.set("Content-Length", String(size));
    headers.delete("Content-Range");
  }
  return headers;
}

function cacheHeaders(source: Headers) {
  const headers = new Headers(source);
  headers.set("Cache-Control", `public, max-age=${CACHE_SECONDS}, immutable`);
  headers.delete("Content-Range");
  headers.delete("X-Audio-Cache");
  return headers;
}

function audioCache(env: AudioEnv) {
  return env.AUDIO_CACHE ?? globalThis.caches?.default;
}

function cacheKey(request: Request, key: string) {
  return new Request(new URL(`/__audio_cache/${key}`, request.url), { method: "GET" });
}

function isInvalidRangeError(error: unknown) {
  return error instanceof Error && /InvalidRange|range.*(?:satisfiable|invalid)/i.test(`${error.name} ${error.message}`);
}

async function issueAudioUrl(request: Request, env: AudioEnv) {
  if (request.method !== "GET") return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET" } });
  if (!isAudioEnabled(env)) return json({ error: "Audio service is temporarily disabled" }, 503);
  if (!env.AUDIO_BUCKET || !env.AUDIO_SIGNING_SECRET) return json({ error: "Audio service is not configured" }, 503);
  const requestUrl = new URL(request.url);
  const key = parseAudioKey(requestUrl.searchParams.get("key"));
  if (!key) return json({ error: "Invalid audio key" }, 400);
  if (await exceedsRateLimit(env.SIGN_RATE_LIMITER, request)) return rateLimitedResponse();
  const expires = Math.floor(Date.now() / 1000) + SIGNED_URL_SECONDS;
  const signature = await sign(env.AUDIO_SIGNING_SECRET, key, expires);
  const audioUrl = new URL(`/${key}`, request.url);
  audioUrl.searchParams.set("e", String(expires));
  audioUrl.searchParams.set("sig", signature);
  return json({ url: audioUrl.toString(), expiresAt: new Date(expires * 1000).toISOString() });
}

async function serveAudio(request: Request, env: AudioEnv, ctx?: AudioExecutionContext) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }
  if (!isAudioEnabled(env)) return new Response("Audio service is temporarily disabled", { status: 503 });
  if (!env.AUDIO_BUCKET || !env.AUDIO_SIGNING_SECRET) return new Response("Audio service is not configured", { status: 503 });
  const url = new URL(request.url);
  const key = parseAudioKey(url.pathname.slice(1));
  if (!key) return new Response("Not Found", { status: 404 });
  const expires = Number(url.searchParams.get("e"));
  const signature = url.searchParams.get("sig") ?? "";
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(expires) || expires < now || expires > now + MAX_FUTURE_SECONDS || !(await verify(env.AUDIO_SIGNING_SECRET, key, expires, signature))) {
    return new Response("Forbidden", { status: 403 });
  }
  const rangeHeader = request.headers.get("Range");
  if (!validRangeSyntax(rangeHeader)) return new Response(null, { status: 416, headers: { "Accept-Ranges": "bytes" } });
  if (await exceedsRateLimit(env.AUDIO_RATE_LIMITER, request)) return rateLimitedResponse();

  const cache = audioCache(env);
  const internalCacheKey = cacheKey(request, key);
  const cached = cache ? await cache.match(internalCacheKey) : undefined;
  if (cached) {
    const size = Number(cached.headers.get("Content-Length"));
    if (Number.isSafeInteger(size) && size >= 0) {
      const range = rangeHeader ? resolveRange(rangeHeader, size) : null;
      if (rangeHeader && !range) {
        return new Response(null, { status: 416, headers: { "Accept-Ranges": "bytes", "Content-Range": `bytes */${size}`, "X-Audio-Cache": "HIT" } });
      }
      const headers = visitorHeaders(cached.headers, "HIT", range, size);
      if (request.method === "HEAD") return new Response(null, { status: range ? 206 : 200, headers });
      if (!range) return new Response(cached.body, { status: 200, headers });
      const bytes = await cached.arrayBuffer();
      return new Response(bytes.slice(range.offset, range.offset + range.length), { status: 206, headers });
    }
  }

  if (request.method === "HEAD") {
    const object = await env.AUDIO_BUCKET.head(key);
    if (!object) return new Response("Not Found", { status: 404 });
    const range = rangeHeader ? resolveRange(rangeHeader, object.size) : null;
    if (rangeHeader && !range) return new Response(null, { status: 416, headers: { "Accept-Ranges": "bytes", "Content-Range": `bytes */${object.size}` } });
    return new Response(null, { status: range ? 206 : 200, headers: visitorHeaders(objectHeaders(object, key, range), "MISS", range, object.size) });
  }

  try {
    const object = await env.AUDIO_BUCKET.get(key, {
      onlyIf: request.headers,
    });
    if (!object) return new Response("Not Found", { status: 404 });
    if (!("body" in object)) return new Response(null, { status: 412, headers: objectHeaders(object, key, null) });
    const range = rangeHeader ? resolveRange(rangeHeader, object.size) : null;
    if (rangeHeader && !range) return new Response(null, { status: 416, headers: { "Accept-Ranges": "bytes", "Content-Range": `bytes */${object.size}` } });

    const baseHeaders = objectHeaders(object, key, null);
    if (object.size > MAX_CACHEABLE_BYTES) {
      if (!range) return new Response(object.body, { status: 200, headers: visitorHeaders(baseHeaders, "MISS", null, object.size) });
      await object.body.cancel();
      const rangedObject = await env.AUDIO_BUCKET.get(key, { onlyIf: request.headers, range: request.headers });
      if (!rangedObject || !("body" in rangedObject)) return new Response("Not Found", { status: 404 });
      const returned = returnedRange(rangedObject.range, rangedObject.size);
      if (!returned) return new Response(null, { status: 416, headers: { "Accept-Ranges": "bytes", "Content-Range": `bytes */${rangedObject.size}` } });
      return new Response(rangedObject.body, { status: 206, headers: visitorHeaders(objectHeaders(rangedObject, key, returned), "MISS", returned, rangedObject.size) });
    }

    const bytes = await new Response(object.body).arrayBuffer();
    if (cache && ctx) {
      ctx.waitUntil(cache.put(internalCacheKey, new Response(bytes.slice(0), { status: 200, headers: cacheHeaders(baseHeaders) })));
    }
    const headers = visitorHeaders(baseHeaders, "MISS", range, object.size);
    return range
      ? new Response(bytes.slice(range.offset, range.offset + range.length), { status: 206, headers })
      : new Response(bytes, { status: 200, headers });
  } catch (error) {
    if (rangeHeader && isInvalidRangeError(error)) return new Response(null, { status: 416, headers: { "Accept-Ranges": "bytes" } });
    throw error;
  }
}

export async function routeAudioRequest(request: Request, env: AudioEnv, ctx?: AudioExecutionContext) {
  const pathname = new URL(request.url).pathname;
  if (pathname === "/api/audio-url") return issueAudioUrl(request, env);
  if (pathname.startsWith("/audio/v1/")) return serveAudio(request, env, ctx);
  return null;
}
