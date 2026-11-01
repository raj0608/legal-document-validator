// What the server checks on every request before anything goes to the AI.
// The browser already hid private details and removed instruction-like text. This is the second line:
// it never trusts the browser, and it fails closed.
import { LANG } from "../shared/i18n/languages.js";
import { sanitize } from "../shared/safety/injection-filter.js";
import { findResidualPii } from "../shared/safety/protect.js";
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
