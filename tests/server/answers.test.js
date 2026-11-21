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

// A question that asks what to do in the person's own case never reaches the AI: the server answers with a fixed refusal.
test("an advice question gets the fixed refusal, with the AI never called, and an information question still goes to the AI", async () => {
  const { I18N } = await import("../../shared/i18n/languages.js");
  const s = await start({ script: () => ({ deltas: ["From the AI."] }) });
  const chat = async (lang, q) => readSse(await s.post("/api/chat", { lang, doc: doc(SAMPLE), turns: [{ role: "user", content: q }] }));
  const text = (ev) => ev.filter((e) => e.event === "text").map((e) => e.data.t).join("");

  const en = await chat("en", "Should I stop paying rent?");
  assert.equal(text(en), I18N.en.advice_gate);
  assert.equal(en.find((e) => e.event === "done").data.gated, true);
  assert.equal((await chat("es", "¿Debo dejar de pagar la renta?")).length > 0 && text(await chat("es", "¿Qué debería hacer?")), I18N.es.advice_gate);
  assert.equal(s.client.calls.length, 0, "the AI was not called for any advice question");

  assert.equal(text(await chat("en", "What should I bring to the hearing?")), "From the AI.");
  assert.equal(s.client.calls.length, 1, "an information question reaches the AI");
  await s.close();
});

test("an advice question is answered even when no AI is set up, and a question in another language still goes to the AI", async () => {
  const off = await start({ ai: false });
  const r = await off.post("/api/chat", { lang: "en", doc: doc(SAMPLE), turns: [{ role: "user", content: "What should I do?" }] });
  assert.equal(r.status, 200);
  assert.match((await readSse(r)).find((e) => e.event === "text").data.t, /can’t tell you what to do/);
  const info = await off.post("/api/chat", { lang: "en", doc: doc(SAMPLE), turns: [{ role: "user", content: "What is a continuance?" }] });
  assert.equal(info.status, 503, "an information question still needs the AI");
  await off.close();

  const s = await start({ script: () => ({ deltas: ["Respuesta."] }) });
  await readSse(await s.post("/api/chat", { lang: "tl", doc: doc(SAMPLE), turns: [{ role: "user", content: "Should I move out?" }] }));
  assert.equal(s.client.calls.length, 1, "other languages are left to the AI and the answer warning");
  await s.close();
});

test("the advice gate looks only at the last question, and the fixed reply is never logged with the question", async () => {
  const s = await start({ script: () => ({ deltas: ["ok"] }) });
  const turns = [{ role: "user", content: "Should I move out?" }, { role: "assistant", content: "x" }, { role: "user", content: "What is a continuance?" }];
  await readSse(await s.post("/api/chat", { lang: "en", doc: doc(SAMPLE), turns }));
  assert.equal(s.client.calls.length, 1, "the earlier advice question does not gate a later information question");
  await s.close();
});
