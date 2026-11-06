// EVAL: does the return-for-correction form keep what a clerk types private, and stay a preview?
// The form is given a tenant's email or phone number. It must use it once, to show the preview, and then forget it:
// not in the server's log, not in an error reply, not sent anywhere, not written anywhere. And it must not be able to send
// a message at all, because no email or text service is connected. Each check below fails the run if that stops being true.
import test, { after, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../../server/http/app.js";
import { open, shutdown } from "../server/fake-anthropic.js";

after(() => Promise.all([...open].map(shutdown)));

const root = fileURLToPath(new URL("../../", import.meta.url));
const NOW = new Date(2026, 10, 9);
// Words that exist nowhere else in the code, so finding one in a log or a reply means it leaked.
const EMAIL = "zq.marker7f3a@example.com", PHONE = "260-555-0199", PHONE_DIGITS = "2605550199", WORDS = "Zebra marker nine";
const GOOD = { lang: "en", channel: "email", reasons: ["not_signed"], other: WORDS, returnedOn: "2026-11-09", to: EMAIL };

// A plain HTTP client, so the test can watch globalThis.fetch without disturbing itself.
function serve(config = {}) {
  const app = createApp({ config: { now: () => NOW, ...config } });
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      open.add(server);
      const port = server.address().port;
      const send = (method, url, body, headers = { "content-type": "application/json" }) => new Promise((done, fail) => {
        const req = http.request({ host: "127.0.0.1", port, path: url, method, headers }, (res) => {
          let text = "";
          res.on("data", (c) => { text += c; });
          res.on("end", () => done({ status: res.statusCode, headers: res.headers, text }));
        });
        req.on("error", fail);
        req.end(body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body));
      });
      resolve({ post: (body, headers) => send("POST", "/api/return-notice/preview", body, headers), send, close: () => shutdown(server) });
    });
  });
}

const REQUESTS = [
  GOOD,
  { ...GOOD, channel: "sms", to: PHONE },
  { ...GOOD, to: EMAIL + ",other@example.com" },       // refused: invalid_contact
  { ...GOOD, other: WORDS + " https://evil.example" },   // refused: invalid_text
  { ...GOOD, channel: "sms", to: PHONE, returnedOn: "2020-01-01" } // refused: invalid_date
];

test("the server log has the method, path and status, and never what the clerk typed", async () => {
  const lines = [];
  for (const level of ["log", "info", "warn", "error", "debug"]) mock.method(console, level, (...a) => lines.push(a.join(" ")));
  const s = await serve();
  for (const body of REQUESTS) await s.post(body);
  await s.post("{ not json " + EMAIL + " " + PHONE);
  await s.close();
  mock.restoreAll();
  const log = lines.join("\n");
  assert.match(log, /POST \/api\/return-notice\/preview 200/, "the request itself is logged");
  for (const secret of [EMAIL, "marker7f3a", PHONE, PHONE_DIGITS, "5550199", WORDS, "Zebra"]) assert.ok(!log.includes(secret), "leaked in the log: " + secret);
  console.log(`eval privacy: ${lines.length} log lines, none holds an address, number or words the clerk typed`);
});

test("an error reply gives a code and nothing the clerk typed", async () => {
  const s = await serve();
  for (const body of [REQUESTS[2], REQUESTS[3], REQUESTS[4], "{ not json " + EMAIL, { ...GOOD, lang: "x" + EMAIL }]) {
    const r = await s.post(body);
    assert.ok(r.status >= 400 && r.status < 500, String(r.status));
    assert.match(r.text, /^\{"error":\{"code":"[a-z_]+"\}\}$/, "an error reply is only a code");
    for (const secret of [EMAIL, "marker7f3a", PHONE, "Zebra"]) assert.ok(!r.text.includes(secret), "echoed in an error: " + secret);
  }
  await s.close();
});

test("a preview never makes a network call: nothing is sent, and nothing is looked up", async () => {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (...a) => { calls.push(String(a[0])); return Promise.reject(new Error("no network in a preview")); };
  try {
    const s = await serve();
    for (const body of REQUESTS) await s.post(body);
    await s.close();
  } finally { globalThis.fetch = realFetch; }
  assert.deepEqual(calls, []);
});

test("the preview says it was not sent, whatever is asked", async () => {
  const s = await serve();
  for (const extra of [{}, { send: true }, { sent: true }, { deliver: "now" }, { dryRun: false }]) {
    const r = await s.post({ ...GOOD, ...extra });
    assert.equal(JSON.parse(r.text).data.sent, false);
  }
  await s.close();
});

test("the code has no way to send or store anything: no network, file, process or storage use", () => {
  const files = [
    ...fs.readdirSync(path.join(root, "server/notify"), { recursive: true }).filter((f) => f.endsWith(".js")).map((f) => path.join("server/notify", f)),
    "server/http/notice-routes.js", "shared/dates/cure-deadline.js", "shared/notice/return-reasons.js"
  ];
  const BANNED_IMPORT = /\bfrom\s+["'](?:node:)?(?:fs|fs\/promises|net|tls|http|https|http2|dgram|dns|child_process|worker_threads|cluster|nodemailer|twilio|@sendgrid\/[\w-]+|resend|mailgun[\w.-]*|aws-sdk|@aws-sdk\/[\w-]+)["']/;
  const BANNED_USE = /\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB|process\.env|eval|Function)\s*[(.]|document\.cookie|\bnew Function\b/;
  for (const f of files) {
    const src = fs.readFileSync(path.join(root, f), "utf8").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
    assert.doesNotMatch(src, BANNED_IMPORT, f + " imports something that can send or store");
    assert.doesNotMatch(src, BANNED_USE, f + " uses something that can send or store");
  }
});

test("the page for it keeps nothing in the browser: no storage, no cookies, no network but our own server", () => {
  const dir = path.join(root, "app/court/return");
  assert.ok(fs.existsSync(dir), "app/court/return/ should exist");
  for (const f of fs.readdirSync(dir, { recursive: true }).filter((f) => /\.(js|html)$/.test(f))) {
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    assert.doesNotMatch(src, /localStorage|sessionStorage|indexedDB|document\.cookie|XMLHttpRequest|WebSocket|sendBeacon|\bfetch\s*\(/, f);
    assert.doesNotMatch(src, /<script\b[^>]*>(?!\s*<\/script>)/, f + " has an inline script");
    assert.doesNotMatch(src, /\b(?:href|src|action)\s*=\s*"https?:/, f + " links or loads something from another site without the page text deciding");
  }
});

test("limits: too many requests are turned away, an oversized body is refused, and only POST with JSON is read", async () => {
  const s = await serve({ rateLimitPerMin: 4 });
  const statuses = [];
  for (let i = 0; i < 6; i++) statuses.push((await s.post(GOOD)).status);
  assert.deepEqual(statuses, [200, 200, 200, 200, 429, 429]);
  await s.close();

  const t = await serve();
  const big = await t.post({ ...GOOD, other: "x".repeat(300000) });
  assert.equal(big.status, 413);
  assert.doesNotMatch(big.text, /xxxx/);
  assert.equal((await t.send("GET", "/api/return-notice/preview")).status, 404);
  const wrongType = await t.post(JSON.stringify(GOOD), { "content-type": "text/plain" });
  assert.equal(wrongType.status, 400);
  await t.close();
});

test("replies are never cached and carry the site's security headers", async () => {
  const s = await serve();
  const r = await s.post(GOOD);
  assert.equal(r.headers["cache-control"], "no-store");
  assert.match(r.headers["content-security-policy"], /default-src 'self'/);
  assert.equal(r.headers["x-content-type-options"], "nosniff");
  assert.match(r.headers["content-type"], /^application\/json/);
  await s.close();
});
