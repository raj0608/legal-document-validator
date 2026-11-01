import { ApiError } from "../errors.js";

// Models sometimes wrap JSON in a code fence or add a sentence around it.
export function parseJson(text) {
  const s = String(text || "").replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  const start = s.search(/[{[]/);
  const end = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  if (start < 0 || end < start) throw new ApiError("invalid_json", 502);
  try { return JSON.parse(s.slice(start, end + 1)); } catch { throw new ApiError("invalid_json", 502); }
}
