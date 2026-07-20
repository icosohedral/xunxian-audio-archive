import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const catalog = JSON.parse(await readFile(new URL("../public/data/music.v1.json", import.meta.url), "utf8"));
const allowedKey = catalog[0].audio.preferredKey;
const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("audio-test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);
const context = { waitUntil() {}, passThroughOnException() {} };

function createCache() {
  const entries = new Map();
  return {
    async match(request) {
      return entries.get(request.url)?.clone();
    },
    async put(request, response) {
      entries.set(request.url, response.clone());
    },
  };
}

function objectMetadata(key, size) {
  return {
    key,
    size,
    httpEtag: '"test-etag"',
    writeHttpMetadata() {},
  };
}

function createEnv() {
  const calls = { get: 0, head: 0 };
  const bytes = new TextEncoder().encode("0123456789");
  const bucket = {
    async get(key, options) {
      calls.get += 1;
      const header = options?.range instanceof Headers ? options.range.get("Range") : null;
      if (header === "bytes=0-3") {
        return { ...objectMetadata(key, bytes.length), range: { offset: 0, length: 4 }, body: bytes.slice(0, 4) };
      }
      return { ...objectMetadata(key, bytes.length), body: bytes };
    },
    async head(key) {
      calls.head += 1;
      return objectMetadata(key, bytes.length);
    },
  };
  return {
    calls,
    env: {
      AUDIO_BUCKET: bucket,
      AUDIO_SIGNING_SECRET: "test-secret-that-is-not-used-in-production",
      AUDIO_ENABLED: "true",
      AUDIO_CACHE: createCache(),
    },
  };
}

async function issueUrl(env, key = allowedKey) {
  const response = await worker.fetch(new Request(`http://localhost/api/audio-url?key=${encodeURIComponent(key)}`), env, context);
  return { response, payload: await response.json() };
}

test("issues a short-lived URL only for allowlisted audio", async () => {
  const { env, calls } = createEnv();
  const { response, payload } = await issueUrl(env);
  assert.equal(response.status, 200);
  assert.equal(new URL(payload.url).pathname, `/${allowedKey}`);
  assert.ok(Date.parse(payload.expiresAt) > Date.now());
  assert.deepEqual(calls, { get: 0, head: 0 });

  const invalid = await issueUrl(env, "audio/v1/music/00/000000000000.opus");
  assert.equal(invalid.response.status, 400);
  assert.deepEqual(calls, { get: 0, head: 0 });
});

test("rejects a bad signature before reading R2", async () => {
  const { env, calls } = createEnv();
  const { payload } = await issueUrl(env);
  const url = new URL(payload.url);
  const signature = url.searchParams.get("sig");
  url.searchParams.set("sig", `${signature.slice(0, -1)}${signature.endsWith("0") ? "1" : "0"}`);
  const response = await worker.fetch(new Request(url), env, context);
  assert.equal(response.status, 403);
  assert.deepEqual(calls, { get: 0, head: 0 });
});

test("rejects malformed multi-range requests before reading R2", async () => {
  const { env, calls } = createEnv();
  const { payload } = await issueUrl(env);
  const response = await worker.fetch(new Request(payload.url, { headers: { Range: "bytes=0-1,4-5" } }), env, context);
  assert.equal(response.status, 416);
  assert.deepEqual(calls, { get: 0, head: 0 });
});

test("serves full, ranged, and HEAD responses through one R2 operation", async () => {
  const { env, calls } = createEnv();
  const { payload } = await issueUrl(env);

  const full = await worker.fetch(new Request(payload.url), env, context);
  assert.equal(full.status, 200);
  assert.equal(full.headers.get("Content-Type"), "audio/ogg; codecs=opus");
  assert.equal(full.headers.get("X-Audio-Cache"), "MISS");
  assert.equal(await full.text(), "0123456789");

  const ranged = await worker.fetch(new Request(payload.url, { headers: { Range: "bytes=0-3" } }), env, context);
  assert.equal(ranged.status, 206);
  assert.equal(ranged.headers.get("Content-Range"), "bytes 0-3/10");
  assert.equal(ranged.headers.get("X-Audio-Cache"), "HIT");
  assert.equal(await ranged.text(), "0123");

  const head = await worker.fetch(new Request(payload.url, { method: "HEAD" }), env, context);
  assert.equal(head.status, 200);
  assert.equal(head.headers.get("Content-Length"), "10");
  assert.equal(head.headers.get("X-Audio-Cache"), "HIT");
  assert.deepEqual(calls, { get: 1, head: 0 });
});

test("warms the full-object cache from a cold Range request", async () => {
  const { env, calls } = createEnv();
  const { payload } = await issueUrl(env);

  const cold = await worker.fetch(new Request(payload.url, { headers: { Range: "bytes=2-5" } }), env, context);
  assert.equal(cold.status, 206);
  assert.equal(cold.headers.get("X-Audio-Cache"), "MISS");
  assert.equal(await cold.text(), "2345");

  const warm = await worker.fetch(new Request(payload.url, { headers: { Range: "bytes=-3" } }), env, context);
  assert.equal(warm.status, 206);
  assert.equal(warm.headers.get("Content-Range"), "bytes 7-9/10");
  assert.equal(warm.headers.get("X-Audio-Cache"), "HIT");
  assert.equal(await warm.text(), "789");
  assert.deepEqual(calls, { get: 1, head: 0 });
});

test("rate limits signing and audio reads before R2 access", async () => {
  const signing = createEnv();
  signing.env.SIGN_RATE_LIMITER = { async limit() { return { success: false }; } };
  const deniedSigning = await worker.fetch(
    new Request(`http://localhost/api/audio-url?key=${encodeURIComponent(allowedKey)}`, { headers: { "CF-Connecting-IP": "192.0.2.1" } }),
    signing.env,
    context,
  );
  assert.equal(deniedSigning.status, 429);
  assert.equal(deniedSigning.headers.get("Retry-After"), "60");
  assert.deepEqual(signing.calls, { get: 0, head: 0 });

  const audio = createEnv();
  const { payload } = await issueUrl(audio.env);
  audio.env.AUDIO_RATE_LIMITER = { async limit() { return { success: false }; } };
  const deniedAudio = await worker.fetch(new Request(payload.url, { headers: { "CF-Connecting-IP": "192.0.2.2" } }), audio.env, context);
  assert.equal(deniedAudio.status, 429);
  assert.deepEqual(audio.calls, { get: 0, head: 0 });
});

test("supports the emergency audio switch", async () => {
  const { env, calls } = createEnv();
  env.AUDIO_ENABLED = "false";
  const response = await worker.fetch(new Request(`http://localhost/api/audio-url?key=${encodeURIComponent(allowedKey)}`), env, context);
  assert.equal(response.status, 503);
  assert.deepEqual(calls, { get: 0, head: 0 });
});
