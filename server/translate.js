// Machine translation of the page's own text. No user text is involved, so nothing private can be in it,
// and the result is the same for everyone: it is cached in memory per language for the life of the process.
import { I18N, FAQ } from "../shared/i18n.js";
import { ApiError } from "./errors.js";
import { translationPrompts } from "./prompts.js";

const placeholders = (s) => (s.match(/\{[a-z]\}/g) || []).sort().join();

// Keep only values that came back in the right shape with the same {n}-style placeholders.
export function validateTranslation(ui, faq) {
  const outUi = {};
  for (const k of Object.keys(I18N.en)) {
    const src = I18N.en[k], v = ui && ui[k];
    if (typeof src === "string") { if (typeof v === "string" && v.trim() && placeholders(v) === placeholders(src)) outUi[k] = v; }
    else if (Array.isArray(src) && Array.isArray(v) && v.length === src.length && v.every((x) => typeof x === "string")) outUi[k] = v;
  }
  const outFaq = Array.isArray(faq) && faq.length === FAQ.length
    ? faq.map((f) => (f && typeof f.q === "string" && typeof f.a === "string" ? { q: f.q, a: f.a } : null))
    : [];
  return { ui: outUi, faq: outFaq };
}

export function createTranslator(ai) {
  const cache = new Map();
  return function translate(langCode, signal) {
    if (cache.has(langCode)) return cache.get(langCode);
    const p = prompts(langCode, signal).catch((e) => { cache.delete(langCode); throw e; });
    cache.set(langCode, p);
    return p;
  };
  async function prompts(langCode, signal) {
    const { ui, faq } = translationPrompts(langCode);
    const req = (content) => ({ messages: [{ role: "user", content }], maxTokens: 64000, signal });
    const [a, b] = await Promise.all([ai.json(req(ui)), ai.json(req(faq))]);
    const out = validateTranslation(a.data, b.data);
    if (!Object.keys(out.ui).length) throw new ApiError("invalid_json", 502);
    return out;
  }
}
