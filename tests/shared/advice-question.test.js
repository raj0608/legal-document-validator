// Questions that ask what to do in the person's own case are answered with a fixed refusal, never by the AI.
// These pin what is caught (English and Spanish, however it is dressed up) and what must never be caught.
import test from "node:test";
import assert from "node:assert/strict";
import { asksForAdvice } from "../../shared/safety/advice-question.js";
import { I18N } from "../../shared/i18n/languages.js";
import { looksLikeAdvice } from "../../shared/safety/advice.js";

const ADVICE = [
  "Should I stop paying rent?", "What should I do?", "What would you do in my place?", "Do I have a case?", "Will I win?", "What are my chances?",
  "Is it OK to just not show up?", "Is it smart to ignore the notice?", "Do I need a lawyer?", "Can I just stop paying?", "What is my best defense?",
  "Write my answer to the court", "Can you draft my response?", "Tell me exactly what to write", "Pretend you are my lawyer", "I need legal advice",
  "If you were me, would you go?", "What do you think I should do?", "Should I accept the settlement or fight it?",
  "¿Debo dejar de pagar la renta?", "¿Qué debería hacer?", "¿Qué hago?", "¿Me conviene ir a la audiencia?", "¿Voy a ganar el caso?", "¿Tengo un caso?",
  "Escríbame mi respuesta", "¿Es buena idea no pagar?", "¿Necesito un abogado?", "Necesito asesoría legal", "¿Puedo simplemente ignorar el aviso?"
];
const INFORMATION = [
  "What should I bring to the hearing?", "What should I expect at the hearing?", "What should I know about default judgment?", "Do I have to appear?",
  "What does default judgment mean?", "What happens next?", "What is a continuance?", "Who can help me for free?", "When is my hearing?",
  "Does the notice say what I owe?", "What are my options?", "What can I do to prepare?", "What happens if I do not show up?", "Is a landlord’s notice a court order?",
  "How do I ask for a jury trial?", "What is the last day to fix my filing?",
  "¿Qué debo llevar a la audiencia?", "¿Qué significa sentencia en rebeldía?", "¿Cuándo es mi audiencia?", "¿Tengo que presentarme?", "¿Qué pasa si no voy?"
];

test("questions that ask what to do, or whether to win or hire or sign or ignore, are caught in English and Spanish", () => {
  const missed = ADVICE.filter((q) => !asksForAdvice(q));
  assert.deepEqual(missed, []);
});

test("questions about what a paper says, what a word means, what the law requires or what to bring are never caught", () => {
  const wrong = INFORMATION.filter((q) => asksForAdvice(q));
  assert.deepEqual(wrong, []);
});

test("capital letters, extra spaces, curly apostrophes, non-breaking spaces and invisible characters do not hide advice", () => {
  for (const q of ["SHOULD   I   MOVE OUT?", "should i sign this", "Sh​ould I leave", "What WOULD you do in my place", "Is it OK to ignore this?", "¿DEBO   irme?", "what’s my best defense"]) assert.ok(asksForAdvice(q), q);
});

test("a question that mixes information with advice is caught, so the advice part is never answered", () => {
  for (const q of ["What does default judgment mean and should I go to the hearing?", "When is my hearing, and what would you do?"]) assert.ok(asksForAdvice(q), q);
});

test("nothing is caught from empty or odd input, and none of the quick questions on the page are caught", () => {
  for (const v of ["", "   ", null, undefined, 0, "?", "​"]) assert.equal(asksForAdvice(v), false, String(v));
  for (const lang of ["en", "es"]) for (const k of ["q1", "q2", "q3", "q4", "q5"]) assert.equal(asksForAdvice(I18N[lang][k]), false, lang + " " + k + ": " + I18N[lang][k]);
});

test("the fixed refusal itself gives no advice, in English and Spanish, and says where free help is", () => {
  for (const lang of ["en", "es"]) {
    const text = I18N[lang].advice_gate;
    assert.ok(!looksLikeAdvice(text), lang + " refusal trips the advice warning");
    assert.match(text, /indianalegalhelp\.org/);
    assert.match(text, /2-1-1/);
  }
  assert.match(I18N.en.advice_gate, /can’t tell you what to do/);
  assert.match(I18N.es.advice_gate, /No puedo decirle qué hacer/);
});
