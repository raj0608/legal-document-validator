// Gemini as the AI, tested with a fake Google client (no network, no key).
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { ApiError as GeminiApiError } from "@google/genai";
import { createGeminiAi, mapGeminiError, toContents } from "../server/gemini.js";
import { choose, build, DEFAULT_GEMINI_MODEL } from "../server/provider.js";
import { createApp } from "../server/app.js";
import { ApiError } from "../server/errors.js";
import { protect } from "../shared/safety.js";
import { SAMPLE, FORM_SAMPLE } from "../shared/samples.js";

// script(params) -> { chunks: [chunk | "ERR"], error }
function fakeGemini(script) {
  const calls = [];
  return {
    calls,
    models: {
      async generateContentStream(params) {
        calls.push(params);
        const s = script(params);
        return (async function* () {
          for (const c of s.chunks) { if (c === "ERR") throw s.error; yield c; }
        })();
      }
    }
  };
}
const chunk = (text, finishReason, extra = {}) => ({ text, candidates: finishReason ? [{ finishReason }] : [{}], ...extra });
const ai = (client, opts = {}) => createGeminiAi({ client, model: "gemini-test", ...opts });
const req = (content = "hello") => ({ system: "RULES", messages: [{ role: "user", content }] });

test("our messages become Gemini contents: assistant is model, and back-to-back turns are joined", () => {
  assert.deepEqual(toContents([{ role: "user", content: "a" }, { role: "assistant", content: "b" }, { role: "user", content: "c" }]), [
    { role: "user", parts: [{ text: "a" }] }, { role: "model", parts: [{ text: "b" }] }, { role: "user", parts: [{ text: "c" }] }
  ]);
  assert.deepEqual(toContents([{ role: "user", content: "a" }, { role: "user", content: "b" }]), [{ role: "user", parts: [{ text: "a\n\nb" }] }]);
});

test("streams text, passes the rules as the system instruction, and caps the output size", async () => {
  const client = fakeGemini(() => ({ chunks: [chunk("Hel"), chunk("lo", "STOP", { usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 3 } })] }));
  const seen = [];
  const ac = new AbortController();
  const r = await ai(client, { maxOutputTokens: 1000 }).stream({ ...req(), maxTokens: 64000, signal: ac.signal, onText: (d) => seen.push(d) });
  assert.deepEqual(seen, ["Hel", "lo"]);
  assert.equal(r.text, "Hello");
  assert.equal(r.truncated, false);
  assert.deepEqual(r.usage, { input_tokens: 7, output_tokens: 3 });
  const p = client.calls[0];
  assert.equal(p.model, "gemini-test");
  assert.equal(p.config.systemInstruction, "RULES");
  assert.equal(p.config.maxOutputTokens, 1000);
  assert.equal(p.config.abortSignal, ac.signal);
  assert.equal(p.config.responseMimeType, undefined);
  assert.equal(p.config.thinkingConfig, undefined, "the model's own thinking default is left alone");
});

test("a thinking level is only sent when the .env asks for one", async () => {
  const client = fakeGemini(() => ({ chunks: [chunk("ok", "STOP")] }));
  await ai(client, { thinkingLevel: "low" }).stream(req());
  assert.deepEqual(client.calls[0].config.thinkingConfig, { thinkingLevel: "LOW" });
});

test("a cut-off answer is truncated; a withheld one is refused with the partial text", async () => {
  const cut = await ai(fakeGemini(() => ({ chunks: [chunk("Part of an answer", "MAX_TOKENS")] }))).stream(req());
  assert.equal(cut.truncated, true);
  for (const why of ["SAFETY", "RECITATION", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII"]) {
    await assert.rejects(ai(fakeGemini(() => ({ chunks: [chunk("I can’t", why)] }))).stream(req()), { code: "refused", text: "I can’t" }, why);
  }
  // the prompt itself was blocked: no candidates at all
  await assert.rejects(ai(fakeGemini(() => ({ chunks: [{ text: undefined, promptFeedback: { blockReason: "JAILBREAK" } }] }))).stream(req()), { code: "refused" });
});

test("an empty answer is an error, not a blank screen", async () => {
  await assert.rejects(ai(fakeGemini(() => ({ chunks: [chunk(undefined, "STOP")] }))).stream(req()), { code: "generic", status: 502 });
});

test("JSON answers: JSON mode is requested, fences are tolerated, a cut-off answer is invalid_json", async () => {
  const client = fakeGemini(() => ({ chunks: [chunk('```json\n{"items":[1]}\n```', "STOP")] }));
  const r = await ai(client).json(req());
  assert.deepEqual(r.data, { items: [1] });
  assert.equal(client.calls[0].config.responseMimeType, "application/json");
  await assert.rejects(ai(fakeGemini(() => ({ chunks: [chunk('{"items":[', "MAX_TOKENS")] }))).json(req()), { code: "invalid_json" });
  await assert.rejects(ai(fakeGemini(() => ({ chunks: [chunk("not json", "STOP")] }))).json(req()), { code: "invalid_json" });
});

test("Google's errors become the codes the page already handles", () => {
  const e = (status, message = "x") => new GeminiApiError({ status, message });
  assert.equal(mapGeminiError(e(429)).code, "rate_limited");
  assert.equal(mapGeminiError(e(403)).code, "unavailable");
  assert.equal(mapGeminiError(e(401)).code, "unavailable");
  assert.equal(mapGeminiError(e(400, '{"error":{"message":"API key not valid. Please pass a valid API key.","details":[{"reason":"API_KEY_INVALID"}]}}')).code, "unavailable", "Google reports a bad key as 400");
  assert.equal(mapGeminiError(e(400, "Invalid JSON payload")).code, "generic");
  assert.equal(mapGeminiError(e(500)).code, "generic");
  assert.equal(mapGeminiError(new TypeError("fetch failed")).code, "generic");
  assert.equal(mapGeminiError(Object.assign(new Error("x"), { name: "AbortError" })).code, "cancelled");
  const ac = new AbortController(); ac.abort();
  assert.equal(mapGeminiError(new Error("whatever"), "", ac.signal).code, "cancelled");
  const ours = new ApiError("refused", 422);
  assert.equal(mapGeminiError(ours), ours);
  assert.equal(mapGeminiError(e(429), "half").text, "half", "the part of the answer that arrived is kept");
});

test("a failure part-way through keeps what had arrived", async () => {
  const client = fakeGemini(() => ({ chunks: [chunk("half "), "ERR"], error: new GeminiApiError({ status: 429, message: "quota" }) }));
  await assert.rejects(ai(client).stream(req()), { code: "rate_limited", text: "half " });
});

test("the key is never part of what is sent or logged by our code", async () => {
  const client = fakeGemini(() => ({ chunks: [chunk("ok", "STOP")] }));
  await ai(client).stream(req("hello"));
  assert.doesNotMatch(JSON.stringify(client.calls), /api[_-]?key|AIza/i);
});

// ---------- through the real server ----------
const open = new Set();
const shutdown = (s) => new Promise((r) => { open.delete(s); s.closeAllConnections(); s.close(() => r()); });
after(() => Promise.all([...open].map(shutdown)));
async function serve(client) {
  const app = createApp({ ai: createGeminiAi({ client, model: "gemini-test" }), config: { log: false } });
  const server = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  open.add(server);
  const base = "http://127.0.0.1:" + server.address().port;
  return { base, post: (path, body) => fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), close: () => shutdown(server) };
}
const doc = (t) => ({ safe: protect(t).safe });

test("the site works end to end on Gemini: explain, chat, blanks, health", async () => {
  const client = fakeGemini((p) => {
    const last = p.contents.at(-1).parts[0].text;
    if (p.config.responseMimeType) return { chunks: [chunk('{"items":[{"label":"Phone","asks":"Your phone number"}]}', "STOP")] };
    return { chunks: [chunk("Plain "), chunk("words ==Tuesday, November 24, 2026==", "STOP")] };
  });
  const s = await serve(client);
  const health = await (await fetch(s.base + "/api/health")).json();
  assert.deepEqual(health, { ok: true, ai: true, demo: false, provider: "gemini" });

  const r = await s.post("/api/explain", { lang: "en", doc: doc(SAMPLE) });
  const text = await r.text();
  assert.match(text, /event: text/);
  assert.match(text, /event: done/);
  const p = client.calls[0];
  assert.match(p.config.systemInstruction, /legal INFORMATION helper/);
  assert.match(p.config.systemInstruction, /Reply in English/);
  assert.match(p.contents[0].parts[0].text, /DOC-[0-9a-f]{16} BEGIN/);
  assert.doesNotMatch(JSON.stringify(p), /Kimi Sample/, "redacted before it reaches Google");

  const chat = await s.post("/api/chat", { lang: "es", doc: doc(SAMPLE), turns: [{ role: "user", content: "q1" }, { role: "assistant", content: "a1" }, { role: "user", content: "q2" }] });
  await chat.text();
  const c = client.calls[1];
  assert.match(c.config.systemInstruction, /Reply in Spanish/);
  assert.deepEqual(c.contents.map((x) => x.role), ["user", "model", "user"]);

  const b = await (await s.post("/api/blanks", { lang: "en", doc: doc(FORM_SAMPLE) })).json();
  assert.deepEqual(b.data.items, [{ label: "Phone", asks: "Your phone number" }]);
  await s.close();
});

test("a bad Gemini key turns the AI helper off for the page (503 unavailable)", async () => {
  const bad = fakeGemini(() => ({ chunks: ["ERR"], error: new GeminiApiError({ status: 400, message: "API key not valid" }) }));
  const s = await serve(bad);
  const r = await s.post("/api/blanks", { lang: "en", doc: doc(FORM_SAMPLE) });
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error.code, "unavailable");
  await s.close();
});

// ---------- choosing the AI from .env ----------
test("the AI is chosen from the environment: Gemini first, either key works, and a missing key explains itself", () => {
  assert.deepEqual(choose({}), { name: null, why: "no API key set" });
  assert.deepEqual(choose({ GEMINI_API_KEY: "k" }), { name: "gemini" });
  assert.deepEqual(choose({ ANTHROPIC_API_KEY: "k" }), { name: "anthropic" });
  assert.deepEqual(choose({ GEMINI_API_KEY: "k", ANTHROPIC_API_KEY: "k" }), { name: "gemini" });
  assert.deepEqual(choose({ AI_PROVIDER: "anthropic", GEMINI_API_KEY: "k", ANTHROPIC_API_KEY: "k" }), { name: "anthropic" });
  assert.deepEqual(choose({ AI_PROVIDER: "GEMINI", GEMINI_API_KEY: "k" }), { name: "gemini" });
  assert.match(choose({ AI_PROVIDER: "gemini" }).why, /GEMINI_API_KEY is empty/);
  assert.match(choose({ AI_PROVIDER: "anthropic" }).why, /ANTHROPIC_API_KEY is empty/);
  assert.match(choose({ AI_PROVIDER: "openai", GEMINI_API_KEY: "k" }).why, /not one of/);
  assert.equal(choose({ GEMINI_API_KEY: "" , ANTHROPIC_API_KEY: ""}).name, null, "an empty key from .env.example counts as no key");
});

test("building the connection: nothing without a key, Gemini's basic free-tier model by default", () => {
  assert.equal(build({}), null);
  const g = build({ AI_PROVIDER: "gemini", GEMINI_API_KEY: "test-not-a-real-key" });
  assert.equal(g.provider, "gemini");
  assert.equal(g.model, "gemini-3.5-flash-lite");
  assert.equal(DEFAULT_GEMINI_MODEL, "gemini-3.5-flash-lite");
  assert.equal(build({ GEMINI_API_KEY: "x", GEMINI_MODEL: "gemini-3.1-flash-lite" }).model, "gemini-3.1-flash-lite");
  assert.equal(build({ ANTHROPIC_API_KEY: "x" }).provider, "anthropic");
});
