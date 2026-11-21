// EVAL: the server under attack. Hostile bodies sent to every route, the secret never leaving the server, address spoofing, a crowd of
// screens and taps at once, files that must not be served, odd methods, and code that must not be able to write to disk. A 500 anywhere,
// or a secret in a reply, fails the run.
import test, { after, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../../server/http/app.js";
import { createAnthropicAi } from "../../server/ai/adapters/anthropic.js";
import { createCourtListener } from "../../server/citations/courtlistener.js";
import { sampleDocket } from "../../server/court/sample-docket.js";
import { fakeClient, open, shutdown } from "../server/fake-anthropic.js";

after(() => Promise.all([...open].map(shutdown)));
const root = fileURLToPath(new URL("../../", import.meta.url));
const SECRET = "TESTTOKEN-7f3a9c-SECRET";

async function serve({ config = {}, citations } = {}) {
  const ai = createAnthropicAi({ client: fakeClient(() => ({ deltas: ["fine"] })), model: "test-model", effort: "medium" });
  const app = createApp({ ai, citations, docket: sampleDocket, config: { log: false, rateLimitPerMin: 100000, dailyCap: 1e9, ...config } });
  const server = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  open.add(server);
  const base = "http://127.0.0.1:" + server.address().port;
  return { base, close: () => shutdown(server), post: (p, body, headers = { "content-type": "application/json" }) => fetch(base + p, { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) }) };
}

// A case on today's board, to aim the board routes at.
const boardId = async (s) => { const r = await fetch(s.base + "/api/court/live"); const { value } = await r.body.getReader().read(); return JSON.parse(/data: (.*)/.exec(new TextDecoder().decode(value))[1]).board[0].id; };

const HOSTILE = [
  null, true, 0, -1, 1e999, "text", "", [], [[[]]], {}, { lang: {} }, { lang: "en", doc: null }, { lang: "en", doc: { safe: 5 } }, { lang: "en", doc: { safe: "x".repeat(60000) } },
  { lang: "en", turns: "x" }, { lang: "en", turns: [null] }, { lang: "en", turns: [{ role: "system", content: "x" }] }, { lang: "en", turns: [{ role: "user", content: { a: 1 } }] },
  { lang: "__proto__" }, { "__proto__": { polluted: 1 } }, { constructor: { prototype: { polluted: 1 } } }, JSON.parse('{"__proto__":{"polluted":1}}'),
  { cites: "x" }, { cites: [null] }, { cites: [{ volume: "1", reporter: "U.S.", page: "1", extra: "x".repeat(1000) }, 5] }, { cites: [{ volume: { a: 1 }, reporter: [], page: null }] },
  { action: { type: "__proto__" } }, { action: null }, { action: { type: "outcome", outcome: { a: 1 } } }, { update: "x" },
  { lang: "en", channel: "email", reasons: "all", other: [], returnedOn: {}, to: ["a@b.com"] }, { lang: "en", channel: "sms", reasons: ["not_signed"], other: "x".repeat(100000), returnedOn: "2026-11-09", to: "2605550147" },
  { lang: "en\u0000", doc: { safe: "\u0000\u0001\u0002" } }, { lang: "en", doc: { safe: "a".repeat(1) + "\ud800" } }
];
const ROUTES = ["/api/explain", "/api/chat", "/api/blanks", "/api/clerk", "/api/translate", "/api/cites", "/api/return-notice/preview"];

test("hostile bodies sent to every route never cause a server error, and the server is still up afterwards", async () => {
  const s = await serve();
  const id = await boardId(s);
  const targets = [...ROUTES, "/api/court/board/" + id, "/api/court/pauses/" + id, "/api/court/pauses/" + id + "/aid"];
  const bad = [];
  let sent = 0;
  for (const route of targets) for (const body of HOSTILE) {
    const r = await s.post(route, body); sent++;
    const text = await r.text();
    if (r.status >= 500 && ![502, 503].includes(r.status)) bad.push(`${route} ${JSON.stringify(body).slice(0, 50)} -> ${r.status}`);
    if (r.status >= 400 && !/^\{"error":\{"code":"[a-z_]+"\}\}$/.test(text)) bad.push(`${route} ${r.status} reply is not a bare error code: ${text.slice(0, 60)}`);
  }
  for (const [type, ct] of [["{ not json", "application/json"], ['{"a":', "application/json"], ["a=b", "application/x-www-form-urlencoded"], ["x", "text/plain"], ["<xml/>", "application/xml"], ["", "application/json"]]) for (const route of ROUTES) {
    const r = await s.post(route, type, { "content-type": ct }); sent++;
    if (r.status >= 500) bad.push(`${route} with ${ct} ${JSON.stringify(type)} -> ${r.status}`);
  }
  const deep = "[".repeat(200000) + "]".repeat(200000);
  assert.ok((await s.post("/api/chat", deep)).status < 500, "a deeply nested body");
  console.log(`eval security: ${sent} hostile requests, ${bad.length} server errors`);
  assert.deepEqual(bad, []);
  assert.equal(({}).polluted, undefined, "the object prototype was polluted");
  assert.equal((await fetch(s.base + "/api/health")).status, 200);
  await s.close();
});

test("the secret never leaves the server: not in a page, a file, a header, an error, or the log", async () => {
  const lines = [];
  for (const level of ["log", "info", "warn", "error", "debug"]) mock.method(console, level, (...a) => lines.push(a.join(" ")));
  const seen = [];
  const fetchFn = async (url, init) => { seen.push(JSON.stringify(init.headers)); return { status: 401, ok: false, json: async () => ({}) }; };
  const s = await serve({ config: { log: true }, citations: createCourtListener({ token: SECRET, fetchFn }) });
  const bodies = [];
  for (const p of ["/", "/api/health", "/app/main.js", "/shared/i18n/english.js", "/app/shared/api/client.js", "/vendor/pdfjs/pdf.min.mjs", "/nothing-here", "/api/nothing"]) { const r = await fetch(s.base + p); bodies.push(p + JSON.stringify([...r.headers]) + (await r.text())); }
  const cites = await s.post("/api/cites", { cites: [{ volume: "397", reporter: "U.S.", page: "254" }] });
  bodies.push(await cites.text() + JSON.stringify([...cites.headers]));
  await s.post("/api/chat", { lang: "en", turns: [{ role: "user", content: "hello" }] });
  mock.restoreAll();
  assert.ok(seen.some((h) => h.includes(SECRET)), "the token is sent to CourtListener, which is its job");
  assert.deepEqual(bodies.filter((b) => b.includes(SECRET)), [], "the token reached the browser");
  assert.deepEqual(lines.filter((l) => l.includes(SECRET)), [], "the token reached the log");
  assert.equal(cites.status, 503, "a refused token is reported as 'unavailable', not echoed");
  await s.close();
});

test("a spoofed forwarding header does not give an attacker a fresh rate-limit allowance", async () => {
  const s = await serve({ config: { rateLimitPerMin: 5 } });
  const statuses = [];
  for (let i = 0; i < 12; i++) statuses.push((await fetch(s.base + "/api/chat", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${i}` }, body: JSON.stringify({ lang: "en", turns: [{ role: "user", content: "hi" }] }) })).status);
  console.log(`eval security: with 12 different spoofed addresses, ${statuses.filter((x) => x === 429).length} requests were still limited`);
  assert.ok(statuses.filter((x) => x === 429).length >= 6, JSON.stringify(statuses));
  await s.close();
});

test("a crowd on the staff board: 300 taps at once leave a valid board, and the watcher limit holds", async () => {
  const s = await serve();
  const id = await boardId(s);
  const taps = [{ type: "arrive", party: "tenant", here: true }, { type: "arrive", party: "landlord", here: true }, { type: "talk", with: "mediator" }, { type: "ready" }, { type: "call" }, { type: "outcome", outcome: "agreement" }, { type: "reopen" }, { type: "arrive", party: "tenant", here: false }, { type: "nope" }];
  const replies = await Promise.all(Array.from({ length: 300 }, (_, i) => s.post("/api/court/board/" + id, { action: taps[i % taps.length] })));
  const codes = replies.map((r) => r.status);
  assert.ok(codes.every((c) => c === 200 || c === 400), "only done or refused: " + [...new Set(codes)]);
  const live = await fetch(s.base + "/api/court/live"); const { value } = await live.body.getReader().read();
  const state = JSON.parse(/data: (.*)/.exec(new TextDecoder().decode(value))[1]);
  assert.ok(["waiting", "here", "talking", "ready", "hearing", "done"].includes(state.board.find((c) => c.id === id).stage));
  assert.equal(new Set(state.board.map((c) => c.id)).size, state.board.length, "no case was duplicated");
  const readers = [];
  const feeds = await Promise.all(Array.from({ length: 60 }, () => fetch(s.base + "/api/court/live")));
  const statuses = feeds.map((r) => r.status);
  feeds.forEach((r) => r.body && r.body.cancel().catch(() => {}));
  console.log(`eval security: 300 simultaneous taps: ${codes.filter((c) => c === 200).length} done, ${codes.filter((c) => c === 400).length} refused; 60 live feeds: ${statuses.filter((c) => c === 503).length} turned away`);
  assert.ok(statuses.filter((c) => c === 200).length <= 50 && statuses.includes(503), "more than 50 live feeds were let in");
  void readers;
  await s.close();
});

test("files that are not the site's own are never served, and odd methods never crash anything", async () => {
  const s = await serve();
  const asked = ["/.env", "/.env.example", "/.git/config", "/package.json", "/package-lock.json", "/server/main.js", "/server/prompts.js", "/server/checks.js", "/node_modules/express/package.json", "/tests/golden/cases.js", "/README.md", "/AGENTS.md", "/data/README.md", "/render.yaml",
    "/app/../server/main.js", "/app/%2e%2e/server/main.js", "/shared/..%2fserver/main.js", "/vendor/../.env", "/vendor/%2e%2e/%2e%2e/.env", "/app/page.html", "/app/layout.html", "/shared/AGENTS.md", "//etc/passwd", "/%00", "/app/\u0000main.js", "/vendor/pdfjs/../../../package.json"];
  const served = [];
  for (const p of asked) { const r = await fetch(s.base + p).catch(() => null); if (r && r.status === 200 && !/<!doctype html>/i.test((await r.text()).slice(0, 20))) served.push(p); }
  assert.deepEqual(served, [], "these were served");
  for (const method of ["PUT", "DELETE", "PATCH", "OPTIONS", "TRACE", "HEAD"]) for (const p of ["/", "/api/chat", "/api/cites", "/api/court/live", "/api/health"]) { const r = await fetch(s.base + p, { method }).catch(() => ({ status: 0 })); assert.ok(r.status < 500, `${method} ${p} -> ${r.status}`); }
  const r = await fetch(s.base + "/");
  assert.match(r.headers.get("content-security-policy"), /default-src 'self'/);
  assert.match(r.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.equal(r.headers.get("x-powered-by"), null);
  await s.close();
});

test("no server or shared code can write to disk, run a program or open a network connection of its own, apart from the lookup it is given", () => {
  const files = ["server", "shared"].flatMap((d) => fs.readdirSync(path.join(root, d), { recursive: true }).filter((f) => f.endsWith(".js")).map((f) => path.join(d, f)));
  // Writing files, running programs, opening raw connections, or running text as code (a regular expression's own .exec is not one of these).
  const WRITES = /\b(?:writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream|mkdir|mkdirSync|rmSync|unlink|unlinkSync|rename|renameSync|copyFile|truncate|child_process|dgram)\b|(?<![\w.])(?:execSync|spawn|spawnSync|fork|eval)\s*\(|(?<![\w.])exec\s*\(|new Function\s*\(|\b(?:net|tls)\.connect\b/;
  const bad = [];
  for (const f of files) {
    const src = fs.readFileSync(path.join(root, f), "utf8").split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");
    if (WRITES.test(src)) bad.push(f + ": " + WRITES.exec(src)[0]);
  }
  assert.deepEqual(bad, []);
});
