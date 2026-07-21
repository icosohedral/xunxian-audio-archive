const SHANGHAI_TIME_ZONE = "Asia/Shanghai";
const VISITOR_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const encoder = new TextEncoder();

interface VisitRateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface VisitEnv {
  VISITS_DB?: D1Database;
  VISIT_RATE_LIMITER?: VisitRateLimiter;
}

function json(payload: unknown, status = 200, cacheControl = "no-store") {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Cache-Control": cacheControl,
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function dateInShanghai(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: SHANGHAI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function clientKey(request: Request) {
  return request.headers.get("CF-Connecting-IP") ?? "unknown-client";
}

async function rateLimited(env: VisitEnv, request: Request) {
  if (!env.VISIT_RATE_LIMITER) return false;
  try {
    return !(await env.VISIT_RATE_LIMITER.limit({ key: clientKey(request) })).success;
  } catch {
    return false;
  }
}

function isSameOrigin(request: Request) {
  const fetchSite = request.headers.get("Sec-Fetch-Site");
  if (fetchSite && fetchSite !== "same-origin") return false;
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}

async function visitorHash(date: string, visitorId: string) {
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(`${date}:${visitorId}`));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function countForDate(db: D1Database, date: string) {
  const row = await db.prepare("SELECT COUNT(*) AS count FROM daily_visitors WHERE visit_date = ?")
    .bind(date)
    .first<{ count: number }>();
  return Number(row?.count ?? 0);
}

async function readVisits(env: VisitEnv) {
  if (!env.VISITS_DB) return json({ error: "Visit counter is not configured" }, 503);
  const date = dateInShanghai();
  const count = await countForDate(env.VISITS_DB, date);
  return json({ date, count }, 200, "public, max-age=30");
}

async function recordVisit(request: Request, env: VisitEnv) {
  if (!env.VISITS_DB) return json({ error: "Visit counter is not configured" }, 503);
  if (!isSameOrigin(request)) return json({ error: "Cross-origin requests are not allowed" }, 403);
  if (await rateLimited(env, request)) {
    return new Response("Too Many Requests", {
      status: 429,
      headers: { "Cache-Control": "no-store", "Retry-After": "60" },
    });
  }
  if (!(request.headers.get("Content-Type") ?? "").toLowerCase().startsWith("application/json")) {
    return json({ error: "Expected JSON" }, 415);
  }
  if (Number(request.headers.get("Content-Length") ?? 0) > 1024) return json({ error: "Request body is too large" }, 413);

  let visitorId: unknown;
  try {
    visitorId = (await request.json() as { visitorId?: unknown }).visitorId;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (typeof visitorId !== "string" || !VISITOR_ID_PATTERN.test(visitorId)) {
    return json({ error: "Invalid visitor ID" }, 400);
  }

  const date = dateInShanghai();
  const hash = await visitorHash(date, visitorId);
  await env.VISITS_DB.prepare(
    "INSERT OR IGNORE INTO daily_visitors (visit_date, visitor_hash) VALUES (?, ?)",
  ).bind(date, hash).run();
  const count = await countForDate(env.VISITS_DB, date);
  return json({ date, count });
}

export async function routeVisitRequest(request: Request, env: VisitEnv) {
  if (new URL(request.url).pathname !== "/api/visits") return null;
  if (request.method === "GET") return readVisits(env);
  if (request.method === "POST") return recordVisit(request, env);
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, POST" } });
}
