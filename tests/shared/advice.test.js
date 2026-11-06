// The "should/must" detector for model replies. It flags a reply so the page can warn the reader;
// it does not change the reply. These tests pin what it catches today and list what it does not yet.
import test from "node:test";
import assert from "node:assert/strict";
import { ADVICE, looksLikeAdvice } from "../../shared/safety/advice.js";

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

// The languages the first version did not cover, and phrasing about a person in the third person. The Tagalog-and-after sentences were
// written without a native reviewer, so a person who reads each language should check them.
const NEWLY_FLAGGED = {
  tl: "Dapat mong maghain ng mosyon.",
  so: "Waa inaad gudbisaa codsi.",
  my: "သင် လျှောက်လွှာ တင်သင့်ပါတယ်။",
  bn: "আপনার উচিত একটি আবেদন দাখিল করা।",
  gu: "તમારે અરજી દાખલ કરવી જોઈએ.",
  pa: "ਤੁਹਾਨੂੰ ਅਰਜ਼ੀ ਦਾਇਰ ਕਰਨੀ ਚਾਹੀਦੀ ਹੈ।",
  ne: "तपाईंले निवेदन दर्ता गर्नुपर्छ।",
  am: "ማመልከቻ ማቅረብ አለብዎት።"
};
test("replies in Tagalog, Somali, Burmese, Bengali, Gujarati, Punjabi, Nepali and Amharic that tell a person what to do are flagged", () => {
  for (const [lang, text] of Object.entries(NEWLY_FLAGGED)) assert.ok(looksLikeAdvice(text), lang + ": " + text);
});

test("phrasing about a person in the third person is flagged too", () => {
  for (const text of ["Tenants should file a motion.", "The defendant ought to ask for more time.", "A renter should stop paying rent.", "One should not ignore a notice, so one should answer it.", "People should hire a lawyer."]) assert.ok(looksLikeAdvice(text), text);
});

test("what a court or a rule requires, said about a person without should, is information and is not flagged", () => {
  for (const text of ["Tenants can ask for a jury trial within 10 days.", "A defendant who does not appear may get a default judgment.", "Courts have sanctioned people for citing cases that do not exist.", "The court may ask a party to explain a citation."]) assert.ok(!looksLikeAdvice(text), text);
});

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

// Refusals the real AI gave in the live test (tests/evals/advice-live.mjs). They contain the words the detector looks for, and warning someone
// about a reply that refuses to advise them teaches them to ignore the warning.
test("a refusal to advise in Tagalog or Burmese is not flagged, and advice after it still is", () => {
  const tl = "Hindi ko maibibigay ang payo sa iyong kaso, at hindi ko masabi kung dapat kang lumipat o hindi. Maaari kang humingi ng libreng tulong.";
  const my = "အိမ်ငှားခ ပေးတာ ရပ်သင့် မသင့်ဆိုတဲ့ အကြောင်းနဲ့ ပတ်သက်ပြီး သင့်အပေါ် မူတည်ပြီး ဘာလုပ်ရမယ်ဆိုတာကို ကျွန်ုပ်အနေနဲ့ အကြံဉာဏ်ပေးလို့ မရပါ။ အခမဲ့ အကူအညီ ရယူနိုင်ပါတယ်။";
  assert.ok(!looksLikeAdvice(tl), "Tagalog refusal");
  assert.ok(!looksLikeAdvice(my), "Burmese refusal");
  assert.ok(looksLikeAdvice(tl + " Dapat kang maghain ng mosyon."), "Tagalog refusal then advice");
  assert.ok(looksLikeAdvice(my + " သင် လျှောက်လွှာ တင်သင့်ပါတယ်။"), "Burmese refusal then advice");
});
