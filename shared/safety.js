// Deterministic protection that runs before any AI call: invisible-character removal, removal of
// text that looks like instructions to an AI, and replacement of private details with tokens like
// [NAME_1]. Tokens are restored only on screen. Pure functions, no DOM, so the same code runs in the
// browser, in the server's second check, and in the tests.

export const DOC_CAP = 30000;

// ---------- Injection filter ----------
export const INVISIBLE = /[​-‏‪-‮⁠-⁤﻿­]/g;
export const INJ = [
  /\b(ignore|disregard|forget|override|bypass)\b[^\n]{0,60}\b(instructions?|rules?|prompts?|guidelines|polic(?:y|ies)|above|previous|prior|system)\b/i,
  /\b(you are now|act as|pretend (?:to be|you are)|roleplay as|new instructions|system prompt|developer mode|jailbreak|do anything now)\b/i,
  /<\/?\s*(system|assistant|user|instructions?|prompt)\s*>/i,
  /^\s*(system|assistant|developer)\s*:/i,
  /\b(note|message|instructions?)\s+(to|for)\s+(the\s+)?(ai|assistant|model|chatbot|llm)s?\b/i,
  /\b(tell|advise|recommend|instruct)\s+(the\s+)?(user|tenant|reader|person)\s+(to|that)\b/i
];
export const INJ_LINE = "[Removed: text that looked like instructions to an AI]";
export function looksLikeInjection(s) { return INJ.some((r) => r.test(s.replace(INVISIBLE, ""))); }
export function sanitize(text) {
  let removed = 0;
  const lines = text.replace(INVISIBLE, "").split("\n").map((line) => {
    if (!looksLikeInjection(line)) return line;
    if (/^\s*(system|assistant|developer)\s*:/i.test(line.replace(INVISIBLE, ""))) { removed++; return INJ_LINE; }
    const parts = line.split(/(?<=[.!?])\s+/);
    return parts.map((p) => { if (looksLikeInjection(p)) { removed++; return INJ_LINE; } return p; }).join(" ");
  });
  return { text: lines.join("\n"), removed };
}

// ---------- Redaction ----------
const STREET = "(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl|Circle|Cir|Parkway|Pkwy|Terrace|Ter|Highway|Hwy|Trail|Trl)";
export const ADDR_RE = new RegExp("\\b\\d{1,6}\\s+(?:[A-Za-z0-9.'-]+\\s+){0,4}" + STREET + "\\b\\.?(?:,?\\s*(?:Apt|Apartment|Unit|Suite|Ste|Lot|#)\\.?\\s*#?[\\w-]+)?", "g");
const MONTH_RE = "(?:January|February|March|April|May|June|July|August|September|October|November|December)";
const TOKEN_TYPES = "NAME|ADDRESS|PHONE|EMAIL|SSN|CARD|ACCOUNT|CASE|ZIP|DOB|ATTY";

export function luhn(num) {
  let sum = 0, dbl = false;
  for (let i = num.length - 1; i >= 0; i--) { let d = +num[i]; if (dbl) { d *= 2; if (d > 9) d -= 9; } sum += d; dbl = !dbl; }
  return num.length >= 13 && sum % 10 === 0;
}
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// One token state per conversation about a paper. Questions typed in the chat are redacted with the
// paper's own state, so a new phone number can never reuse (and later be restored as) the paper's [PHONE_1].
export function createTokenState() {
  return { tokens: new Map(), exact: new Map(), back: {}, counts: {}, n: {} };
}
function makeToken(ts, type, v) {
  ts.n[type] = (ts.n[type] || 0) + 1;
  const token = "[" + type + "_" + ts.n[type] + "]";
  ts.back[token] = v;
  ts.counts[type] = (ts.counts[type] || 0) + 1;
  return token;
}
function tok(ts, type, val) {
  const v = val.trim();
  const key = type + "|" + v.toLowerCase();
  if (ts.tokens.has(key)) return ts.tokens.get(key);
  const token = makeToken(ts, type, v);
  ts.tokens.set(key, token);
  ts.exact.set(type + "|" + v, token);
  return token;
}
// Same as tok(), but the exact spelling is kept, so "KIMI SAMPLE" is restored as "KIMI SAMPLE".
function tokExact(ts, type, val) {
  const key = type + "|" + val;
  if (ts.exact.has(key)) return ts.exact.get(key);
  const token = makeToken(ts, type, val);
  ts.exact.set(key, token);
  return token;
}

// Words that are part of a name's spelling but are also ordinary words: never redacted on their own.
const NAME_PART_STOP = new Set(("llc inc corp co lp llp ltd pllc the and of for apartments apartment properties property management realty housing " +
  "group company partners holdings rentals homes village court county state indiana superior circuit small claims mr mrs ms dr jr sr ii iii").split(" "));
const LB = "(?<![\\p{L}\\p{N}_])", LA = "(?![\\p{L}\\p{N}_])";

// Second pass: once a name is known, hide every other mention of it (full name in any capitalization,
// then each first/last name part as it was written).
function hideKnownNames(s, ts) {
  const full = Array.from(new Set(Object.entries(ts.back).filter(([k]) => k.startsWith("[NAME_")).map(([, v]) => v)));
  full.sort((a, b) => b.length - a.length);
  for (const name of full) {
    const body = escRe(name).replace(/\s+/g, "\\s+");
    s = s.replace(new RegExp(LB + body + LA, "giu"), (m) => tokExact(ts, "NAME", m));
  }
  const parts = new Set();
  for (const name of full) {
    for (const p of name.split(/\s+/).map((x) => x.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ""))) {
      if (p.length >= 3 && !NAME_PART_STOP.has(p.toLowerCase())) parts.add(p);
    }
  }
  for (const p of Array.from(parts).sort((a, b) => b.length - a.length)) {
    s = s.replace(new RegExp(LB + escRe(p) + LA, "gu"), (m) => tokExact(ts, "NAME", m));
  }
  return s;
}

// Replace values that already have a token (non-name types; names are handled by hideKnownNames).
function applyKnown(s, ts) {
  const known = Object.entries(ts.back).filter(([k]) => !k.startsWith("[NAME_")).sort((a, b) => b[1].length - a[1].length);
  for (const [token, val] of known) if (val) s = s.split(val).join(token);
  return s;
}

export function redactText(text, ts, opts = {}) {
  let s = applyKnown(text, ts);
  s = s.replace(/\b\d{3}-\d{2}-\d{4}\b/g, (m) => tok(ts, "SSN", m));
  s = s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, (m) => tok(ts, "EMAIL", m));
  s = s.replace(/\b\d{2}[A-Z]\d{2}-\d{4}-[A-Z]{2}-\d{1,6}\b/g, (m) => tok(ts, "CASE", m));
  s = s.replace(/\b(attorney\s+(?:no\.?|number|#)\s*[:#]?\s*)([\d-]{4,})/gi, (m, a, b) => a + tok(ts, "ATTY", b));
  s = s.replace(/\b(?:account|acct\.?|routing)\s*(?:no\.?|number|#)?\s*[:#]?\s*(\d[\d-]{5,})/gi, (m, b) => m.replace(b, tok(ts, "ACCOUNT", b)));
  s = s.replace(/\b(?:\d[ -]?){13,19}\b/g, (m) => {
    if (!luhn(m.replace(/\D/g, ""))) return m;
    const core = m.replace(/[ -]+$/, ""); // the pattern can swallow the space after the number; give it back
    return tok(ts, "CARD", core) + m.slice(core.length);
  });
  s = s.replace(/(?:\(\s*\d{3}\s*\)\s*|\b\d{3}[-.\s])\d{3}[-.\s]\d{4}\b/g, (m) => tok(ts, "PHONE", m));
  s = s.replace(new RegExp("\\b(date of birth|birth ?date|DOB|born on)\\s*[:\\-]?\\s*(\\d{1,2}\\/\\d{1,2}\\/\\d{2,4}|" + MONTH_RE + "\\s+\\d{1,2},?\\s+\\d{4})", "gi"), (m, a, b) => m.replace(b, tok(ts, "DOB", b)));
  s = s.replace(ADDR_RE, (m) => tok(ts, "ADDRESS", m));
  s = s.replace(/\b(Indiana|IN)(\s*,?\s+)(\d{5}(?:-\d{4})?)\b/g, (m, a, b, c) => a + b + tok(ts, "ZIP", c));
  const nameTok = (b) => { const core = b.replace(/[.,]+$/, ""); return tok(ts, "NAME", core) + b.slice(core.length); };
  s = s.replace(/\b(Plaintiff|Defendant|Tenant|Landlord|Petitioner|Respondent|Printed name|Print name|Filed by|Name|Signed)\s*:[ \t]*([A-Z][A-Za-z.'’-]+(?:[ \t]+[A-Z][A-Za-z.'’&-]+){0,4})/g, (m, a, b) => m.replace(b, nameTok(b)));
  s = s.replace(/\b(by (?:its|their|his|her) attorney|attorney for (?:the )?(?:plaintiff|defendant))[ \t]+([A-Z][A-Za-z.'’-]*(?:[ \t]+[A-Z][A-Za-z.'’-]+){0,3})/gi, (m, a, b) => a + " " + nameTok(b));
  s = s.replace(/(^|\n)([A-Z][A-Za-z.'’-]+(?:[ \t]+[A-Z][A-Za-z.'’&-]+){0,5}),[ \t]*(Plaintiff|Defendant)\b/g, (m, pre, a, b) => pre + tok(ts, "NAME", a) + ", " + b);
  (opts.extraNames || []).filter((x) => x.length >= 2).forEach((nm) => { s = s.replace(new RegExp("\\b" + escRe(nm) + "\\b", "gi"), (m) => tok(ts, "NAME", m)); });
  return hideKnownNames(s, ts);
}

export function parseExtraNames(value) {
  return String(value || "").split(",").map((x) => x.trim()).filter((x) => x.length >= 2);
}

// One-shot helper: redact with a fresh token state.
export function redact(text, opts = {}) {
  const ts = opts.tokens || createTokenState();
  const out = redactText(text, ts, opts);
  return { text: out, back: ts.back, counts: ts.counts, tokens: ts };
}

export function unredact(s, back) {
  if (!back) return s;
  return s.replace(new RegExp("\\[(?:" + TOKEN_TYPES + ")_\\d+\\]", "g"), (m) => (back[m] !== undefined ? back[m] : m));
}

// Build what is sent: injection filter first, then redaction.
export function protect(raw, opts = {}) {
  const clean = raw.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const capped = clean.slice(0, DOC_CAP);
  const san = sanitize(capped);
  const red = redact(san.text, opts);
  return { raw: capped, truncated: clean.length > DOC_CAP, safe: red.text, back: red.back, counts: red.counts, removed: san.removed, tokens: red.tokens };
}

// Used by the server as a second check: structured identifiers that should already be tokens.
// Names and ZIP codes are heuristic, so they are not treated as proof that redaction failed.
export function findResidualPii(text) {
  return Object.keys(redact(text).counts).filter((k) => k !== "NAME" && k !== "ZIP");
}

// ---------- "Should/must" detector for model replies ----------
// The detector below is lexical, so it also fires on the sentence the rules REQUIRE when someone asks for advice
// ("I can't advise you on what you should do") and on a reply that says the paper does not state "whether you should…".
// Warning someone about the very reply that refuses to advise them is confusing and teaches them to ignore the warning.
// So these exact constructions, and only these, are set aside before testing. Anything else in the sentence still counts:
// "I can't advise you on what you should do, but you should file a motion" is still flagged (by the second "you should").
const REFUSALS = [
  /\b(?:can(?:not|['’]t)|can not|am unable to|am not able to)\s+(?:advise|tell|say)(?:\s+you)?\s+(?:on\s+|about\s+)?(?:what|whether|if)\s+you\s+(?:should|must|need to)(?:\s+do)?\b/gi,
  /\b(?:do|does|did)(?:n['’]t|\s+not)\s+(?:say|state|tell|specify|address|explain|mention)\s+(?:what|whether|if)\s+you\s+(?:should|must|need to)\b/gi,
  /\bno puedo\s+(?:aconsejar|asesorar|decir)(?:le|te)?\s+(?:sobre\s+)?(?:qu[eé]|lo que|si)\s+(?:usted\s+)?(?:deber[ií]a(?:s|n)?|debe(?:s|n)?)(?:\s+hacer)?/gi,
  /\bno\s+(?:dice|dicen|indica|indican|establece|establecen|especifica|especifican)\s+(?:qu[eé]|lo que|si)\s+(?:usted\s+)?(?:deber[ií]a(?:s|n)?|debe(?:s|n)?)/gi
];
export function looksLikeAdvice(text) {
  let s = String(text);
  for (const re of REFUSALS) s = s.replace(re, " ");
  return ADVICE.test(s);
}

export const ADVICE = new RegExp([
  "\\b(you should|you shouldn['’]t|you must|you need to|i recommend|i suggest|i advise|my advice)\\b",
  "deber[ií]a(?:s|n)?\\b|le recomiendo|te recomiendo|le sugiero|le aconsejo",
  "vous devriez|je vous recommande|você deveria|você deve|recomendo que|sie sollten|ich empfehle|dovresti|dovrebbe|ti consiglio",
  "bạn nên|你应该|您应该|你應該|您應該|建议您|建議您|해야 합니다|하셔야|추천합니다|вам следует|вы должны|рекомендую",
  "ou ta dwe|ou dwe|आपको चाहिए|सलाह देता|powinien|powinna|powinieneś|べきです|することをお勧め|يجب عليك|ينبغي|أنصحك|باید|آپ کو چاہیے"
].join("|"), "i");
