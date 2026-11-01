// How a failure reaches the page: an error code as JSON, or an "error" event once an answer is streaming.
import { mapError } from "../anthropic.js";
import { sse } from "./streaming.js";

const sendError = (res, e) => {
  const err = mapError(e);
  if (res.headersSent) { // already streaming: report the failure as an event
    if (err.code !== "cancelled") sse(res, "error", { code: err.code, text: err.text || "" });
    return res.end();
  }
  res.status(err.status).json({ error: { code: err.code } });
};
export const wrap = (fn) => async (req, res) => { try { await fn(req, res); } catch (e) { sendError(res, e); } };

export const notFound = (req, res) => res.status(404).json({ error: { code: "not_found" } });
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  if (err && err.type === "entity.too.large") return res.status(413).json({ error: { code: "prompt_too_large" } });
  if (err && err.status >= 400 && err.status < 500) return res.status(400).json({ error: { code: "bad_request" } });
  console.error("unexpected error:", err && err.name); // the name only: messages could echo user text
  res.status(500).json({ error: { code: "generic" } });
};
