// Demo mode: the real server with sample answers instead of an AI.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../../server/http/app.js";
import { createAnthropicAi } from "../../server/ai/adapters/anthropic.js";
import { SAMPLE, CLERK_SAMPLE, FORM_SAMPLE } from "../../shared/sample-papers.js";
import { open, shutdown, readSse, doc } from "./fake-anthropic.js";

after(() => Promise.all([...open].map(shutdown)));

test("demo mode answers from the paper, labels every answer, and is announced to the page", async () => {
  const { demoClient } = await import("../../server/ai/adapters/demo-client.js");
  const app = createApp({ ai: createAnthropicAi({ client: demoClient(), model: "demo" }), config: { log: false, demo: true } });
  const server = await new Promise((r) => { const x = app.listen(0, "127.0.0.1", () => r(x)); });
  open.add(server);
  const base = "http://127.0.0.1:" + server.address().port;
  const post = (path, body) => fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  assert.deepEqual(await (await fetch(base + "/api/health")).json(), { ok: true, ai: true, demo: true });

  const ev = await readSse(await post("/api/explain", { lang: "en", doc: doc(SAMPLE) }));
  const text = ev.filter((e) => e.event === "text").map((e) => e.data.t).join("");
  assert.match(text, /\[Demo\]/);
  assert.match(text, /==Tuesday, November 24, 2026==/); // the paper's own date, not an invented one
  assert.doesNotMatch(text, /you should|you must/i);

  const chat = await readSse(await post("/api/chat", { lang: "en", doc: doc(SAMPLE), turns: [{ role: "user", content: "What happens next?" }] }));
  assert.match(chat.filter((e) => e.event === "text").map((e) => e.data.t).join(""), /\[Demo\].*What happens next/s);

  const blanks = (await (await post("/api/blanks", { lang: "en", doc: doc(FORM_SAMPLE) })).json()).data.items;
  assert.ok(blanks.length >= 3 && blanks.every((b) => /^\[Demo\]/.test(b.asks)));
  assert.ok(blanks.some((b) => /Signature/.test(b.label)));

  const clerk = (await (await post("/api/clerk", { lang: "en", doc: doc(CLERK_SAMPLE) })).json()).data;
  assert.match(clerk.summary, /^\[Demo\]/);
  assert.equal(clerk.items.length, 3);
  assert.equal(clerk.items[0].quote, "The document is not signed.");

  const tr = await post("/api/translate", { lang: "fr" }); // not faked: fails like an outage
  assert.equal(tr.status, 502);
  await shutdown(server);
});
