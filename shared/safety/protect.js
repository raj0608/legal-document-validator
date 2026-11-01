// Deterministic protection that runs before any AI call: invisible-character removal, removal of
// text that looks like instructions to an AI, and replacement of private details with tokens like
// [NAME_1]. Tokens are restored only on screen. Pure functions, no DOM, so the same code runs in the
// browser, in the server's second check, and in the tests.
import { sanitize } from "./injection-filter.js";
import { redact } from "./redaction.js";

export const DOC_CAP = 30000;

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
