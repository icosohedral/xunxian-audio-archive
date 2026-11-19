import assert from "node:assert/strict";
import test from "node:test";

async function render(pathname = "/", origin = "http://localhost", headers = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(new URL(pathname, origin), { headers: { accept: "text/html", ...headers } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("renders the archive homepage", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>寻仙音乐资料库/);
  assert.match(html, /6,414/);
  assert.match(html, /寻仙音乐资料库/);
  assert.match(html, /今日来访/);
  assert.match(html, /topbar-visitors/);
  assert.doesNotMatch(html, /codex-preview/);
});

test("renders all archive routes", async () => {
  for (const pathname of ["/music", "/sounds"]) {
    const response = await render(pathname);
    assert.equal(response.status, 200, pathname);
  }
});

test("redirects the retired about page to the homepage", async () => {
  const response = await render("/about");
  assert.equal(response.status, 301);
  assert.equal(response.headers.get("Location"), "http://localhost/");
});

test("publishes canonical metadata and crawler discovery files", async () => {
  for (const [pathname, canonical] of [["/", "/"], ["/music", "/music"], ["/sounds", "/sounds"]]) {
    const response = await render(pathname);
    const html = await response.text();
    assert.match(html, new RegExp(`<link rel="canonical" href="https://music\\.xunxian\\.wiki${canonical === "/" ? "/?" : canonical}"`), pathname);
    assert.match(html, /<meta property="og:image" content="https:\/\/music\.xunxian\.wiki\/og-archive\.png"/);
  }

  const robots = await render("/robots.txt");
  assert.equal(robots.status, 200);
  assert.match(await robots.text(), /Sitemap: https:\/\/music\.xunxian\.wiki\/sitemap\.xml/);

  const sitemap = await render("/sitemap.xml");
  assert.equal(sitemap.status, 200);
  const xml = await sitemap.text();
  assert.match(xml, /<loc>https:\/\/music\.xunxian\.wiki\/music<\/loc>/);
  assert.match(xml, /<loc>https:\/\/music\.xunxian\.wiki\/sounds<\/loc>/);
});

test("adds production security headers and redirects the legacy host", async () => {
  const response = await render("/", "https://music.xunxian.wiki");
  assert.equal(response.headers.get("Strict-Transport-Security"), "max-age=31536000");
  assert.equal(response.headers.get("X-Frame-Options"), "DENY");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.match(response.headers.get("Content-Security-Policy") ?? "", /frame-ancestors 'none'/);

  const legacy = await render("/music?from=legacy", "https://xunxian-web.catcher-in-the-rye-v.workers.dev");
  assert.equal(legacy.status, 308);
  assert.equal(legacy.headers.get("Location"), "https://music.xunxian.wiki/music?from=legacy");
});

test("renders English for English browsers and keeps a saved language choice", async () => {
  const english = await (await render("/music", undefined, { "accept-language": "en-US,en;q=0.9" })).text();
  assert.match(english, /<html lang="en"/);
  assert.match(english, /<title>Music \| Xunxian Music Archive<\/title>/);
  assert.match(english, /Search file names or tags/);

  const chineseBrowser = await (await render("/", undefined, { "accept-language": "zh-CN,zh;q=0.9,en;q=0.8" })).text();
  assert.match(chineseBrowser, /<html lang="zh-CN"/);
  assert.match(chineseBrowser, /今日来访/);

  const savedChinese = await (await render("/", undefined, { "accept-language": "en-US", cookie: "xunxian-locale=zh" })).text();
  assert.match(savedChinese, /<title>寻仙音乐资料库/);

  const savedEnglish = await (await render("/sounds", undefined, { cookie: "xunxian-locale=en" })).text();
  assert.match(savedEnglish, /<title>Sounds \| Xunxian Music Archive<\/title>/);
  assert.match(savedEnglish, /Visits today/);
});
