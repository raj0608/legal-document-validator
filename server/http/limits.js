// Limits on the API: requests per client per minute, and a daily ceiling on AI calls for everyone.
import { rateLimit } from "express-rate-limit";
import { ApiError } from "../errors.js";

export function perMinuteLimit(cfg) {
  return rateLimit({
    windowMs: 60_000, limit: cfg.rateLimitPerMin, standardHeaders: "draft-7", legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ error: { code: "rate_limited" } })
  });
}

// A global daily ceiling on AI calls, so a runaway script cannot run up the bill. In memory only.
export function createDailyCap(cfg) {
  let day = "", used = 0;
  return function spend() {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== day) { day = today; used = 0; }
    if (++used > cfg.dailyCap) throw new ApiError("rate_limited", 429);
  };
}
