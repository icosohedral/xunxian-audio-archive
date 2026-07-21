import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("visits-test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);
const context = { waitUntil() {}, passThroughOnException() {} };

function createDatabase() {
  const rows = new Map();
  return {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async run() {
              assert.match(sql, /INSERT OR IGNORE INTO daily_visitors/);
              const [date, visitorHash] = values;
              const visitors = rows.get(date) ?? new Set();
              visitors.add(visitorHash);
              rows.set(date, visitors);
              return { success: true };
            },
            async first() {
              assert.match(sql, /SELECT COUNT\(\*\) AS count/);
              return { count: rows.get(values[0])?.size ?? 0 };
            },
          };
        },
      };
    },
  };
}

function request(method, visitorId, headers = {}) {
  return new Request("https://music.xunxian.wiki/api/visits", {
    method,
    headers: method === "POST" ? { "Content-Type": "application/json", ...headers } : headers,
    body: method === "POST" ? JSON.stringify({ visitorId }) : undefined,
  });
}

test("records one anonymous browser visit per Beijing calendar day", async () => {
  const env = { VISITS_DB: createDatabase() };
  const visitorId = "d8fca5e8-437e-4df7-a0ca-c7eb3f30ce3d";

  const first = await worker.fetch(request("POST", visitorId), env, context);
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date()), count: 1 });

  const duplicate = await worker.fetch(request("POST", visitorId), env, context);
  assert.equal(duplicate.status, 200);
  assert.equal((await duplicate.json()).count, 1);

  const secondVisitor = await worker.fetch(request("POST", "863e5cd6-2453-4ead-9d7a-5c7b45875732"), env, context);
  assert.equal((await secondVisitor.json()).count, 2);

  const total = await worker.fetch(request("GET"), env, context);
  assert.equal(total.status, 200);
  assert.equal((await total.json()).count, 2);
  assert.equal(total.headers.get("Cache-Control"), "public, max-age=30");
});

test("rejects invalid, cross-origin, and rate-limited visit writes", async () => {
  const env = { VISITS_DB: createDatabase() };
  const invalid = await worker.fetch(request("POST", "not-a-uuid"), env, context);
  assert.equal(invalid.status, 400);

  const crossOrigin = await worker.fetch(request("POST", "d8fca5e8-437e-4df7-a0ca-c7eb3f30ce3d", { Origin: "https://example.com" }), env, context);
  assert.equal(crossOrigin.status, 403);

  env.VISIT_RATE_LIMITER = { async limit() { return { success: false }; } };
  const limited = await worker.fetch(request("POST", "d8fca5e8-437e-4df7-a0ca-c7eb3f30ce3d"), env, context);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("Retry-After"), "60");
});

test("keeps the site available when the visits database is not bound", async () => {
  const response = await worker.fetch(request("GET"), {}, context);
  assert.equal(response.status, 503);
});
