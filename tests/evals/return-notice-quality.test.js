// EVAL: is every message the form can write fit to send to a tenant?
// The form can write 64 combinations of reasons, in two languages, as an email or a text, with or without the clerk's own words.
// Every one is written and graded: no advice and no threats, nothing but facts, one fixed web address, no private details,
// plain words, a text of a sensible length, and the right last day. One bad message anywhere fails the run.
import test from "node:test";
import assert from "node:assert/strict";
import { composeReturnNotice } from "../../server/notify/return-message.js";
import { REASONS, HELP_SITE } from "../../server/notify/templates.js";
import { looksLikeAdvice } from "../../shared/safety/advice.js";
import { findResidualPii } from "../../shared/safety/protect.js";
import { REASON_IDS } from "../../shared/notice/return-reasons.js";

const OTHER = { en: "Page 2 is missing", es: "Falta la página 2" };
const subsets = Array.from({ length: 2 ** REASON_IDS.length }, (_, n) => REASON_IDS.filter((_, i) => n & (1 << i))).filter((s) => s.length);
const cases = [];
for (const lang of ["en", "es"]) for (const channel of ["email", "sms"]) for (const reasons of subsets) for (const other of ["", OTHER[lang]]) {
  cases.push({ lang, channel, reasons, other, returnedOn: "2026-11-09" });
}

// Words that make a statement into advice or a threat. The shared advice detector covers "you should" and its kin in many languages;
// these add the commands and warnings a returned-filing notice might drift into.
const THREAT_OR_ORDER = {
  en: /\b(you (?:should|must|need to|have to|ought)|we (?:recommend|suggest|advise)|make sure|be sure to|don'?t forget|failure to|or else|will be dismissed|you will lose|penalt|sanction|immediately|urgent)/i,
  es: /\b(debe|debes|deben|debería|tiene que|tienen que|usted necesita|necesitas|le recomendamos|le sugerimos|asegúrese|no olvide|perderá|sanción|inmediatamente|urgente)\b/i
};

// Reading grade (Flesch-Kincaid) with a plain syllable count. The design guide asks for about 8th grade at most.
function grade(text) {
  const syl = (w) => Math.max(1, (w.toLowerCase().replace(/e$/, "").match(/[aeiouy]+/g) || []).length);
  const words = text.match(/[A-Za-z']+/g) || [];
  const sentences = text.split(/[.!?:\n]+/).filter((s) => s.trim()).length;
  return 0.39 * words.length / sentences + 11.8 * words.reduce((n, w) => n + syl(w), 0) / words.length - 15.59;
}

const mark = (n, bad, what) => console.log(`eval message quality (${what}): ${n - bad}/${n} messages fit to send`);
const failures = (check) => cases.map((c) => [c, composeReturnNotice(c)]).flatMap(([c, m]) => check(c, m).map((why) => `${c.lang} ${c.channel} [${c.reasons}] ${c.other ? "+other" : ""}: ${why}`));

test("no message gives advice, orders, or threatens, in either language", () => {
  const bad = failures((c, m) => [looksLikeAdvice(m.body) && "advice", THREAT_OR_ORDER[c.lang].test(m.body + (m.subject || "")) && "order or threat"].filter(Boolean));
  mark(cases.length, bad.length, "no advice");
  assert.deepEqual(bad, []);
});

test("every message says it is a test and not from a court, so it cannot pass for an official one", () => {
  const bad = failures((c, m) => /\[(Test|Prueba)\]|\[(Test message|Mensaje de prueba)/.test(m.body) ? [] : ["no test marker"]);
  mark(cases.length, bad.length, "test marker");
  assert.deepEqual(bad, []);
});

test("the only web address in any message is the legal help site", () => {
  const bad = failures((c, m) => {
    const found = ((m.body + " " + (m.subject || "")).match(/[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu) || []).filter((d) => d !== HELP_SITE);
    return found.length ? ["unexpected address: " + found] : [];
  });
  mark(cases.length, bad.length, "only one address");
  assert.deepEqual(bad, []);
});

test("no message holds a name, a number, an email address or anything the privacy check would hide", () => {
  const bad = failures((c, m) => findResidualPii(m.body).length ? ["private-looking detail: " + JSON.stringify(findResidualPii(m.body))] : []);
  mark(cases.length, bad.length, "no private details");
  assert.deepEqual(bad, []);
});

test("each message lists exactly the reasons chosen, and no others", () => {
  const bad = failures((c, m) => {
    const idx = c.channel === "email" ? 0 : 1;
    return REASON_IDS.flatMap((id) => (m.body.includes(REASONS[c.lang][id][idx]) === c.reasons.includes(id) ? [] : [id + (c.reasons.includes(id) ? " missing" : " leaked in")]))
      .concat(c.other && !m.body.includes(c.other) ? ["other words missing"] : []);
  });
  mark(cases.length, bad.length, "right reasons");
  assert.deepEqual(bad, []);
});

test("every message gives the last day to fix it, in the reader's language", () => {
  const want = { en: { email: "Friday, November 13, 2026", sms: "Fri, Nov 13" }, es: { email: "viernes, 13 de noviembre de 2026", sms: "vie, 13 de nov" } };
  const bad = failures((c, m) => (m.body.includes(want[c.lang][c.channel]) ? [] : ["wrong or missing last day, wanted " + want[c.lang][c.channel]]));
  mark(cases.length, bad.length, "right last day");
  assert.deepEqual(bad, []);
});

test("email is in plain words: English at or below an 8th-grade reading level", () => {
  const worst = Math.max(...cases.filter((c) => c.lang === "en" && c.channel === "email").map((c) => grade(composeReturnNotice(c).body)));
  console.log(`eval message quality (reading level): hardest English email reads at grade ${worst.toFixed(1)} (limit 8)`);
  assert.ok(worst <= 8, "grade " + worst);
});

test("texts stay short: one part for one reason in English, and a limit on the rest", () => {
  const parts = (c) => composeReturnNotice(c).parts;
  // the longest date a text can carry is "Wed, Sep 30"; the brackets in "[Test]" count double in a text message
  for (const id of REASON_IDS) assert.equal(parts({ lang: "en", channel: "sms", reasons: [id], other: "", returnedOn: "2026-09-25" }), 1, id);
  const sms = cases.filter((c) => c.channel === "sms");
  const worst = (lang, other) => Math.max(...sms.filter((c) => c.lang === lang && !!c.other === other).map(parts));
  console.log(`eval message quality (text length): most parts in a text, English ${worst("en", false)}, Spanish ${worst("es", false)} (accents use a wider encoding, 70 letters to a part)`);
  assert.ok(worst("en", false) <= 2 && worst("en", true) <= 3);
  assert.ok(worst("es", false) <= 5 && worst("es", true) <= 7);
});

test("the same input always gives the same message, and a different day gives a different last day", () => {
  const c = cases[0];
  assert.deepEqual(composeReturnNotice(c), composeReturnNotice({ ...c }));
  assert.notEqual(composeReturnNotice(c).body, composeReturnNotice({ ...c, returnedOn: "2026-11-16" }).body);
});
