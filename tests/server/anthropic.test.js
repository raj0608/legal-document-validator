// The Anthropic adapter turns its own SDK's errors into the codes the page knows, even when a call fails before it starts.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import Anthropic from "@anthropic-ai/sdk";
import { createApp } from "../../server/http/app.js";
import { createAnthropicAi } from "../../server/ai/adapters/anthropic.js";
import { ApiError } from "../../server/errors.js";
import { protect } from "../../shared/safety/protect.js";
import { FORM_SAMPLE } from "../../shared/sample-papers.js";

const open = new Set();
const shutdown = (server) => new Promise((r) => { open.delete(server); server.closeAllConnections(); server.close(() => r()); });
after(() => Promise.all([...open].map(shutdown)));

const throwsAtOnce = (err) => ({ messages: { stream() { throw err; } } });
const betaThrowsAtOnce = (err) => ({ beta: { messages: { stream() { throw err; } } } });

async function start(client, options = {}) {
  const app = createApp({ ai: createAnthropicAi({ client, model: "m", ...options }), config: { log: false } });
  const server = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  open.add(server);
  const base = "http://127.0.0.1:" + server.address().port;
  const post = (path, body) => fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { post, close: () => shutdown(server) };
}
const blanks = { lang: "en", doc: { safe: protect(FORM_SAMPLE).safe } };
const chat = { lang: "en", turns: [{ role: "user", content: "hi" }] };

test("an Anthropic call that fails before any answer arrives still gets the codes the page handles", async () => {
  const cases = [
    [Object.create(Anthropic.RateLimitError.prototype), 429, "rate_limited"],
    [Object.create(Anthropic.AuthenticationError.prototype), 503, "unavailable"],
    [Object.create(Anthropic.PermissionDeniedError.prototype), 503, "unavailable"],
    [new Anthropic.APIUserAbortError(), 499, "cancelled"],
    [new Error("boom: Kimi Sample"), 502, "generic"]
  ];
  for (const [err, status, code] of cases) {
    const s = await start(throwsAtOnce(err));
    const r = await s.post("/api/blanks", blanks);
    assert.equal(r.status, status, code);
    assert.deepEqual(await r.json(), { error: { code } });
    const c = await s.post("/api/chat", chat);
    assert.equal(c.status, 200, code);
    assert.match(c.headers.get("content-type"), /^text\/event-stream/);
    assert.equal(await c.text(), code === "cancelled" ? "" : "event: error\ndata: " + JSON.stringify({ code, text: "" }) + "\n\n", code);
    await s.close();
  }
  const f = await start(betaThrowsAtOnce(Object.create(Anthropic.RateLimitError.prototype)), { fallback: true });
  const r = await f.post("/api/blanks", blanks);
  assert.equal(r.status, 429);
  assert.deepEqual(await r.json(), { error: { code: "rate_limited" } });
  await f.close();
});

test("the Anthropic adapter itself turns a call that fails at once into one of our errors", async () => {
  const ai = createAnthropicAi({ client: throwsAtOnce(Object.create(Anthropic.RateLimitError.prototype)), model: "m" });
  await assert.rejects(ai.stream({ messages: [{ role: "user", content: "hi" }] }), (e) => e instanceof ApiError && e.code === "rate_limited" && e.status === 429 && !("text" in e));
  const beta = createAnthropicAi({ client: betaThrowsAtOnce(Object.create(Anthropic.AuthenticationError.prototype)), model: "m", fallback: true });
  await assert.rejects(beta.json({ messages: [{ role: "user", content: "hi" }] }), (e) => e instanceof ApiError && e.code === "unavailable" && e.status === 503);
});
