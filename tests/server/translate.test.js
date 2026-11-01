// Page translation: only a language code goes in, and what comes back is checked and cached.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { validateTranslation } from "../../server/translate.js";
import { I18N } from "../../shared/i18n/languages.js";
import { FAQ } from "../../shared/i18n/faq.js";
import { open, shutdown, start } from "./fake-anthropic.js";

after(() => Promise.all([...open].map(shutdown)));

test("translation: only a language code in, validated and cached out", async () => {
  const mark = (v) => (typeof v === "string" ? "¡" + v : v.map((x) => "¡" + x));
  const script = (p) => {
    const c = p.messages[0].content;
    if (c.includes('"brand"')) return { deltas: [JSON.stringify(Object.fromEntries(Object.entries(I18N.en).map(([k, v]) => [k, k === "in_days" ? "sin marcador" : mark(v)])))] };
    return { deltas: [JSON.stringify(FAQ.map((f) => ({ q: mark(f.q.en), a: mark(f.a.en) })))] };
  };
  const s = await start({ script });
  const r = await s.post("/api/translate", { lang: "fr" });
  const out = await r.json();
  assert.equal(out.ui.brand, "¡Let’s Get Ready for Court");
  assert.ok(!("in_days" in out.ui), "a value that dropped the {n} placeholder is discarded");
  assert.equal(out.faq.length, FAQ.length);
  assert.equal(s.client.calls.length, 2);
  await (await s.post("/api/translate", { lang: "fr" })).json();
  assert.equal(s.client.calls.length, 2, "second request is served from memory");
  assert.ok(!s.client.calls.some((c) => /Kimi/.test(JSON.stringify(c))));
  assert.equal((await s.post("/api/translate", { lang: "es" })).status, 400);
  assert.equal((await s.post("/api/translate", { lang: "klingon" })).status, 400);
  await s.close();
  assert.deepEqual(validateTranslation(null, null), { ui: {}, faq: [] });
});
