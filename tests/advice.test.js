// The "should/must" detector for model replies. It flags a reply so the page can warn the reader;
// it does not change the reply. These tests pin what it catches today and list what it does not yet.
import test from "node:test";
import assert from "node:assert/strict";
import { ADVICE, looksLikeAdvice } from "../shared/safety.js";

const FLAGGED = {
  en: "You should file a motion.",
  en2: "I recommend that you wait.",
  es: "Usted debería presentar una moción.",
  fr: "Vous devriez déposer une requête.",
  pt: "Você deve apresentar o pedido.",
  de: "Sie sollten einen Antrag stellen.",
  it: "Dovresti presentare una richiesta.",
  vi: "Bạn nên nộp đơn.",
  "zh-Hans": "您应该提交申请。",
  ru: "Вам следует подать ходатайство.",
  ht: "Ou dwe depoze yon mosyon.",
  hi: "आपको चाहिए कि आवेदन दें।",
  pl: "Powinien Pan złożyć wniosek.",
  ja: "申請するべきです。",
  ar: "يجب عليك تقديم طلب.",
  ur: "آپ کو چاہیے کہ درخواست دیں۔"
};
const NOT_FLAGGED = [
  "The notice says the hearing is on Tuesday, November 24, 2026.",
  "A landlord’s notice is not a court order.",
  "Indiana Legal Help has a continuance form."
];

test("replies with should/must-style words are flagged in the languages the pattern covers", () => {
  for (const [lang, text] of Object.entries(FLAGGED)) assert.ok(ADVICE.test(text), lang + ": " + text);
});

test("plain statements of information are not flagged", () => {
  for (const text of NOT_FLAGGED) assert.ok(!ADVICE.test(text), text);
});

// Known gaps, kept visible. Closing them is a separate change.
test.todo("flag replies in Tagalog, Somali, Burmese, Bengali, Gujarati, Punjabi, Nepali and Amharic (no patterns yet)");
test.todo("flag third-person phrasing such as “Tenants should file…” (only second-person is caught today)");

// Found in live testing with Gemini: asking "Should I stop paying rent?" made the page warn about the reply that REFUSED to advise.
test("a reply that refuses to advise, or says the paper does not say what to do, is not flagged", () => {
  for (const text of [
    "I cannot advise you on what you should do in your case.",
    "I can’t tell you what you should do. Indiana Legal Help can.",
    "I am unable to advise you about whether you should move out.",
    "The provided documents do not state whether you should stop paying rent or move out.",
    "The paper doesn’t say what you must do next.",
    "No puedo aconsejarle sobre lo que debería hacer en su caso.",
    "Los documentos no indican si usted debería mudarse."
  ]) { assert.ok(!looksLikeAdvice(text), text); }
});

test("a refusal does not give cover: advice in the same reply is still flagged", () => {
  for (const text of [
    "I cannot advise you on what you should do, but you should file a motion.",
    "I can’t advise you. You must leave by Friday.",
    "The paper does not state whether you should pay, but I recommend that you pay.",
    "I cannot advise you, but you should stop paying rent.",
    "No puedo aconsejarle sobre lo que debería hacer, pero debería presentar una moción.",
    "You should file a motion."
  ]) { assert.ok(looksLikeAdvice(text), text); }
});

test("everything the plain detector catches is still caught by the refusal-aware one", () => {
  for (const [lang, text] of Object.entries(FLAGGED)) assert.ok(looksLikeAdvice(text), lang);
  for (const text of NOT_FLAGGED) assert.ok(!looksLikeAdvice(text), text);
});
