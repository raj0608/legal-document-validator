// The page and files the server sends, with their security headers, and the server's logs and rate limits.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { SAMPLE } from "../../shared/sample-papers.js";
import { open, shutdown, start, readSse, doc } from "./fake-anthropic.js";

after(() => Promise.all([...open].map(shutdown)));

test("rate limits: per client per minute, and a daily ceiling for everyone", async () => {
  const s = await start({ config: { rateLimitPerMin: 2 } });
  const body = { lang: "en", doc: doc(SAMPLE) };
  assert.equal((await s.post("/api/explain", body)).status, 200);
  assert.equal((await s.post("/api/explain", body)).status, 200);
  const third = await s.post("/api/explain", body);
  assert.equal(third.status, 429);
  assert.equal((await third.json()).error.code, "rate_limited");
  await s.close();
  const d = await start({ config: { dailyCap: 1 } });
  assert.equal((await d.post("/api/explain", body)).status, 200);
  assert.equal((await d.post("/api/explain", body)).status, 429);
  await d.close();
});

test("the page and shared modules are served, with security headers", async () => {
  const s = await start();
  const home = await s.get("/");
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Let’s Get Ready for Court/);
  const csp = home.headers.get("content-security-policy");
  assert.match(csp, /connect-src 'self'/);
  assert.doesNotMatch(csp, /https?:\/\//, "no third-party hosts are allowed");
  assert.equal(home.headers.get("x-powered-by"), null);
  assert.equal((await s.get("/shared/safety/protect.js")).status, 200);
  // pdf.js and the font are served from this site, so the page makes no request to any other host
  const html = await (await s.get("/")).text();
  assert.doesNotMatch(html, /<(?:link|script|img|iframe)\b[^>]*(?:href|src)="(?:https?:)?\/\//i, "scripts, styles and fonts are never loaded from another host");
  for (const url of ["/vendor/pdfjs/pdf.min.mjs", "/vendor/pdfjs/pdf.worker.min.mjs", "/vendor/pdfjs/cmaps/UniGB-UCS2-H.bcmap", "/vendor/pdfjs/wasm/openjpeg.wasm", "/vendor/pdfjs/standard_fonts/FoxitDingbats.pfb", "/vendor/fonts/400.css", "/vendor/fonts/files/atkinson-hyperlegible-latin-400-normal.woff2"]) {
    assert.equal((await s.get(url)).status, 200, url);
  }
  for (const m of html.matchAll(/(?:href|src)="(\/[^"]+)"/g)) assert.equal((await s.get(m[1])).status, 200, m[1]);
  assert.equal((await s.get("/app/main.js")).status, 200);
  // only scripts and styles are served from app/ and shared/: markup goes out inside the page, and the rule files never do
  for (const url of ["/app/layout.html", "/app/page.html", "/app/AGENTS.md", "/shared/AGENTS.md"]) assert.equal((await s.get(url)).status, 404, url);
  const api = await s.get("/api/health");
  assert.equal(api.headers.get("cache-control"), "no-store");
  assert.equal((await s.get("/api/nope")).status, 404);
  await s.close();
});

test("request logs never contain what the person sent", async () => {
  const lines = [];
  const orig = console.log;
  console.log = (...a) => lines.push(a.join(" "));
  try {
    const s = await start({ config: { log: true } });
    await readSse(await s.post("/api/explain", { lang: "en", doc: { safe: "Tuesday ZZQ-MARKER hearing" } }));
    await s.close();
  } finally { console.log = orig; }
  assert.ok(lines.some((l) => /POST \/api\/explain 200/.test(l)), "log lines: " + JSON.stringify(lines));
  assert.ok(!lines.some((l) => /ZZQ-MARKER/.test(l)));
});
