import { createReadStream } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { serve } from "@hono/node-server";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "../../..");
const sourceRoot = resolve(projectRoot, "original_data");
const generatedRoot = resolve(projectRoot, "generated");
const manifestPath = resolve(generatedRoot, "manifests/audio-v1.json");
const port = Number(process.env.MEDIA_PORT ?? 8787);
const app = new Hono();

const sourceKeys = new Set<string>();
for (const kind of ["music", "sound"] as const) {
  for (const name of await readdir(resolve(sourceRoot, kind))) {
    if (/^[A-Za-z0-9_.-]+\.(ogg|wav)$/i.test(name)) sourceKeys.add(`source/${kind}/${name}`);
  }
}

const generatedKeys = new Set<string>();
try {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    complete?: unknown;
    items?: Array<{ variants?: Array<{ key?: unknown }> }>;
  };
  if (manifest.complete !== true || !Array.isArray(manifest.items)) throw new Error("Generated audio manifest is incomplete.");
  for (const item of manifest.items) {
    for (const variant of item.variants ?? []) {
      if (typeof variant.key !== "string" || !/^audio\/v1\/(music|sound)\/([a-f0-9]{2})\/([a-f0-9]{12})\.(opus|mp3)$/.test(variant.key)) {
        throw new Error("Generated audio manifest contains an invalid key.");
      }
      const match = /^audio\/v1\/(music|sound)\/([a-f0-9]{2})\/([a-f0-9]{12})\.(opus|mp3)$/.exec(variant.key);
      if (!match || match[2] !== match[3].slice(0, 2)) throw new Error("Generated audio manifest contains an invalid shard.");
      generatedKeys.add(variant.key);
    }
  }
} catch (error) {
  if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
}

app.use("/*", cors({
  origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
  allowMethods: ["GET", "HEAD", "OPTIONS"],
  allowHeaders: ["Range"],
  exposeHeaders: ["Accept-Ranges", "Content-Length", "Content-Range"],
}));

function resolveAudioKey(rawKey: string | undefined) {
  if (!rawKey || rawKey.includes("\\") || rawKey.includes("\0")) return null;
  let decoded: string;
  try { decoded = decodeURIComponent(rawKey); } catch { return null; }
  let root: string;
  let relative: string;
  if (sourceKeys.has(decoded)) {
    root = sourceRoot;
    relative = decoded.replace(/^source\//, "");
  } else if (generatedKeys.has(decoded)) {
    root = generatedRoot;
    relative = decoded;
  } else {
    return null;
  }
  const absolute = resolve(root, relative);
  if (!absolute.startsWith(`${root}${sep}`)) return null;
  return { key: decoded, absolute };
}

function audioMime(path: string) {
  const extension = extname(path).toLowerCase();
  if (extension === ".wav") return "audio/wav";
  if (extension === ".mp3") return "audio/mpeg";
  if (extension === ".opus") return "audio/ogg; codecs=opus";
  return "audio/ogg";
}

app.get("/health", (c) => c.json({ ok: true }));

app.get("/api/audio-url", (c) => {
  const audio = resolveAudioKey(c.req.query("key"));
  if (!audio) return c.json({ error: "Invalid audio key" }, 400);
  const encodedPath = audio.key.split("/").map(encodeURIComponent).join("/");
  return c.json({ url: `http://localhost:${port}/${encodedPath}`, expiresAt: null });
});

async function serveAudio(c: Context, key: string) {
  const audio = resolveAudioKey(key);
  if (!audio) return c.text("Not found", 404);

  let info;
  try { info = await stat(audio.absolute); } catch { return c.text("Not found", 404); }
  if (!info.isFile()) return c.text("Not found", 404);

  const mime = audioMime(audio.absolute);
  const baseHeaders = {
    "Accept-Ranges": "bytes",
    "Content-Type": mime,
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  };
  const range = c.req.header("range");

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) return c.body(null, 416, { ...baseHeaders, "Content-Range": `bytes */${info.size}` });
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Math.min(Number(match[2]), info.size - 1) : info.size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= info.size) {
      return c.body(null, 416, { ...baseHeaders, "Content-Range": `bytes */${info.size}` });
    }
    const headers = {
      ...baseHeaders,
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${info.size}`,
    };
    if (c.req.method === "HEAD") return c.body(null, 206, headers);
    const body = Readable.toWeb(createReadStream(audio.absolute, { start, end })) as ReadableStream;
    return c.body(body, 206, headers);
  }

  const headers = { ...baseHeaders, "Content-Length": String(info.size) };
  if (c.req.method === "HEAD") return c.body(null, 200, headers);
  return c.body(Readable.toWeb(createReadStream(audio.absolute)) as ReadableStream, 200, headers);
}

app.on(["GET", "HEAD"], "/audio/:key{.+}", (c) => serveAudio(c, `audio/${c.req.param("key")}`));
app.on(["GET", "HEAD"], "/source/:key{.+}", (c) => serveAudio(c, `source/${c.req.param("key")}`));

serve({ fetch: app.fetch, port }, () => {
  console.log(`Local audio service: http://localhost:${port}`);
});
