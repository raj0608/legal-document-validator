// What the server checks on every request before anything goes to the AI.
// The browser already hid private details and removed instruction-like text. This is the second line:
// it never trusts the browser, and it fails closed.
import { LANG } from "../shared/i18n/languages.js";
import { sanitize } from "../shared/safety/injection-filter.js";
import { findResidualPii } from "../shared/safety/protect.js";
import { looksLikeInjection } from "../shared/safety/injection-filter.js";
import { REASON_IDS, OTHER_MAX } from "../shared/notice/return-reasons.js";
import { fromISO, toISO } from "../shared/dates/date-math.js";
import { parseEmail, parsePhone } from "./notify/contact.js";
import { ApiError, bad } from "./errors.js";

export const LIMITS = { doc: 45000, question: 2000, answer: 12000, turns: 10 };

export function parseLang(v) {
  if (typeof v !== "string" || !Object.hasOwn(LANG, v)) throw bad("unknown language");
  return v;
}

// Returns the text to send. Instruction-like text is removed again; leftover identifiers reject the request.
function cleanText(text, max, what) {
  if (typeof text !== "string") throw bad(what + " must be text");
  if (text.length > max) throw new ApiError("prompt_too_large", 413);
  const clean = sanitize(text).text;
  if (findResidualPii(clean).length) throw new ApiError("pii_detected", 422);
  return clean;
}

export function checkDoc(doc, { required = true } = {}) {
  if (doc == null) {
    if (required) throw bad("doc is required");
    return null;
  }
  if (typeof doc !== "object" || Array.isArray(doc)) throw bad("doc must be an object");
  const text = cleanText(doc.safe, LIMITS.doc, "doc.safe");
  if (!text.trim()) throw bad("doc is empty");
  return text;
}

// The last few turns, starting with a user turn and ending with one.
export function checkTurns(turns) {
  if (!Array.isArray(turns) || !turns.length) throw bad("turns is required");
  let out = turns.slice(-LIMITS.turns).map((t) => {
    if (!t || (t.role !== "user" && t.role !== "assistant")) throw bad("bad turn role");
    const max = t.role === "user" ? LIMITS.question : LIMITS.answer;
    const content = cleanText(t.content, max, "turn content");
    if (!content.trim()) throw bad("empty turn");
    return { role: t.role, content };
  });
  while (out.length && out[0].role !== "user") out = out.slice(1);
  if (!out.length || out.at(-1).role !== "user") throw bad("turns must end with a question");
  return out;
}

// The citations to look up: only a volume, a reporter and a page for each, so nothing else about a filing can ride along.
export const MAX_CITES = 100;
export function checkCites(cites) {
  if (!Array.isArray(cites) || !cites.length) throw bad("cites is required");
  if (cites.length > MAX_CITES) throw new ApiError("prompt_too_large", 413);
  return cites.map((c) => {
    if (!c || typeof c.volume !== "string" || typeof c.reporter !== "string" || typeof c.page !== "string") throw bad("bad citation");
    if (!/^\d{1,4}$/.test(c.volume) || !/^\d{1,5}$/.test(c.page) || !/^[A-Za-z0-9.' ]{1,20}$/.test(c.reporter)) throw bad("bad citation");
    return { volume: c.volume, reporter: c.reporter.trim(), page: c.page };
  });
}

// A filing returned for correction: who to tell, why, and when it was returned. Anything that does not fit is refused.
const refuse = (code) => new ApiError(code, 400);
const OTHER_OK = /^[\p{L}\p{N} .,'’()\-:;?!&]+$/u; // letters, digits, spaces and plain punctuation: no slashes, line breaks, brackets, symbols or invisible marks
// Anything that reads as a link or an address, however it is dressed up, and a word that mixes alphabets to pass for another word.
const LINKISH = /:\/\/|www\.|@|[\p{L}\p{N}-]+\.\p{L}{2,}|\bdot\)?\s*(?:com|org|net|gov|edu|io|co|us|info)\b/iu;
const MIXED_ALPHABETS = /(?=\S*\p{Script=Latin})(?=\S*[\p{Script=Cyrillic}\p{Script=Greek}])\S+/u;

function checkOther(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") throw refuse("invalid_text");
  // NFKC first, so a fullwidth "ｗｗｗ.ｅｖｉｌ.ｃｏｍ" is read as the address it is.
  const s = value.normalize("NFKC").trim().replace(/ {2,}/g, " ");
  if (s.length > OTHER_MAX || !OTHER_OK.test(s) || LINKISH.test(s) || MIXED_ALPHABETS.test(s) || looksLikeInjection(s) || findResidualPii(s).length || /\d{5,}/.test(s)) throw refuse("invalid_text");
  return s;
}

const DAY = 86400000;
function checkReturnedOn(value, now) {
  const d = typeof value === "string" ? fromISO(value) : null;
  if (!d || toISO(d) !== value) throw refuse("invalid_date");
  const days = Math.round((d - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / DAY);
  if (days > 1 || days < -30) throw refuse("invalid_date"); // returned today or recently, not in the far past or future
  return value;
}

export function checkReturnNotice(body, now = new Date()) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw bad("body must be an object");
  const lang = body.lang;
  if (lang !== "en" && lang !== "es") throw bad("message language must be en or es");
  const channel = body.channel;
  if (channel !== "email" && channel !== "sms") throw bad("channel must be email or sms");
  const reasons = body.reasons === undefined ? [] : body.reasons;
  if (!Array.isArray(reasons) || reasons.length > REASON_IDS.length || new Set(reasons).size !== reasons.length || !reasons.every((r) => REASON_IDS.includes(r))) throw refuse("invalid_reason");
  const other = checkOther(body.other);
  if (!reasons.length && !other) throw refuse("invalid_reason");
  const returnedOn = checkReturnedOn(body.returnedOn, now);
  const to = channel === "email" ? parseEmail(body.to) : parsePhone(body.to);
  return { lang, channel, reasons, other, returnedOn, to };
}
