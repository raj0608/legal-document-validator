// How the AI's answers and failures reach the page. A fake Anthropic client stands in for the AI (no network, no key).
import test, { after } from "node:test";
import assert from "node:assert/strict";
import Anthropic from "@anthropic-ai/sdk";
import { createApp } from "../../server/http/app.js";
import { createAnthropicAi, mapError } from "../../server/ai/adapters/anthropic.js";
import { parseJson } from "../../server/ai/json.js";
import { SAMPLE, CLERK_SAMPLE, FORM_SAMPLE } from "../../shared/sample-papers.js";
import { open, shutdown, start, readSse, doc } from "./fake-anthropic.js";

after(() => Promise.all([...open].map(shutdown)));

test("health says whether the AI helper is on", async () => {
  const on = await start(), off = await start({ ai: false });
  assert.deepEqual(await (await on.get("/api/health")).json(), { ok: true, ai: true, demo: false });
  assert.deepEqual(await (await off.get("/api/health")).json(), { ok: true, ai: false, demo: false });
  await on.close(); await off.close();
});

test("blanks and clerk return parsed JSON, even when the model wraps it in a code fence", async () => {
  const s = await start({ script: (p) => ({ deltas: [/blank/.test(p.messages[0].content) ? '```json\n{"items":[{"label":"Phone","asks":"Your phone number"}]}\n```' : 'Here you go: {"summary":"A notice.","items":[]}'] }) });
  const b = await (await s.post("/api/blanks", { lang: "en", doc: doc(FORM_SAMPLE) })).json();
  assert.deepEqual(b.data.items, [{ label: "Phone", asks: "Your phone number" }]);
  const c = await (await s.post("/api/clerk", { lang: "en", doc: doc(CLERK_SAMPLE) })).json();
  assert.equal(c.data.summary, "A notice.");
  await s.close();
});

test("a JSON answer that is not JSON, or was cut off, becomes invalid_json", async () => {
  const s = await start({ script: () => ({ deltas: ["I cannot do that"] }) });
  const r = await s.post("/api/blanks", { lang: "en", doc: doc(FORM_SAMPLE) });
  assert.equal(r.status, 502);
  assert.equal((await r.json()).error.code, "invalid_json");
  await s.close();
  const t = await start({ script: () => ({ deltas: ['{"items":['], stop: "max_tokens" }) });
  assert.equal((await (await t.post("/api/blanks", { lang: "en", doc: doc(FORM_SAMPLE) })).json()).error.code, "invalid_json");
  await t.close();
});

test("a cut-off answer is reported as truncated, a refusal as refused with the partial text", async () => {
  const s = await start({ script: () => ({ deltas: ["Part of an answer"], stop: "max_tokens" }) });
  const ev = await readSse(await s.post("/api/explain", { lang: "en", doc: doc(SAMPLE) }));
  assert.deepEqual(ev.at(-1), { event: "done", data: { truncated: true } });
  await s.close();
  const r = await start({ script: () => ({ deltas: ["I can’t"], stop: "refusal" }) });
  const ev2 = await readSse(await r.post("/api/explain", { lang: "en", doc: doc(SAMPLE) }));
  assert.deepEqual(ev2.at(-1), { event: "error", data: { code: "refused", text: "I can’t" } });
  await r.close();
});

test("API failures become the codes the page already handles", async () => {
  const rate = Object.create(Anthropic.RateLimitError.prototype);
  const auth = Object.create(Anthropic.AuthenticationError.prototype);
  assert.equal(mapError(rate).code, "rate_limited");
  assert.equal(mapError(auth).code, "unavailable");
  assert.equal(mapError(new Error("boom: Kimi Sample")).code, "generic");
  const s = await start({ script: () => ({ deltas: ["half"], error: rate }) });
  const ev = await readSse(await s.post("/api/chat", { lang: "en", turns: [{ role: "user", content: "hi" }] }));
  assert.deepEqual(ev.at(-1), { event: "error", data: { code: "rate_limited", text: "half" } });
  const j = await start({ script: () => ({ error: auth }) });
  const r = await j.post("/api/blanks", { lang: "en", doc: doc(FORM_SAMPLE) });
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error.code, "unavailable");
  await s.close(); await j.close();
});

test("without an API key the AI routes say unavailable and nothing else breaks", async () => {
  const s = await start({ ai: false });
  const r = await s.post("/api/explain", { lang: "en", doc: doc(SAMPLE) });
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error.code, "unavailable");
  assert.equal((await s.get("/")).status, 200);
  await s.close();
});

test("parseJson handles fences, chatter, and garbage", () => {
  assert.deepEqual(parseJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJson('Sure! [1,2]'), [1, 2]);
  assert.throws(() => parseJson("no json here"), { code: "invalid_json" });
  assert.throws(() => parseJson("{broken"), { code: "invalid_json" });
});

test("a client that disconnects cancels the upstream call", async () => {
  let sawAbort = false;
  const client = {
    messages: {
      stream: (params, opts) => ({
        on() { return this; },
        finalMessage: () => new Promise((_, rej) => opts.signal.addEventListener("abort", () => { sawAbort = true; rej(new Anthropic.APIUserAbortError()); }))
      })
    }
  };
  const app = createApp({ ai: createAnthropicAi({ client, model: "m" }), config: { log: false } });
  const server = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  open.add(server);
  const ac = new AbortController();
  const p = fetch("http://127.0.0.1:" + server.address().port + "/api/explain", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lang: "en", doc: doc(SAMPLE) }), signal: ac.signal }).catch(() => {});
  await new Promise((r) => setTimeout(r, 150));
  ac.abort();
  await p;
  await new Promise((r) => setTimeout(r, 150));
  assert.ok(sawAbort);
  await shutdown(server);
});
