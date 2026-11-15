// The court staff pages' routes: a live feed of their shared state, and the changes staff and the agency make to it.
// The feed is server-sent events, like the AI's streamed answers: no new library, and the browser reconnects by itself.
import express from "express";
import { ApiError } from "../errors.js";
import { perMinuteLimit } from "./limits.js";
import { sse } from "./streaming.js";
import { wrap } from "./error-responses.js";
import { checkCourtChange } from "../checks.js";

const MAX_WATCHERS = 50; // live feeds open at once, across every screen
const HEARTBEAT_MS = 25000; // a comment line now and then, so a proxy does not close a quiet feed
const ID = /^[a-z0-9-]{1,24}$/;

const idOf = (req) => { if (!ID.test(req.params.id)) throw new ApiError("not_found", 404); return req.params.id; };
const body = (req) => req.body || {};

export function addCourtRoutes(api, { court, cfg }) {
  const r = express.Router();
  // A board is many quick taps from a few screens, so these routes get their own per-minute limit, apart from the AI's.
  r.use(perMinuteLimit({ rateLimitPerMin: Math.max(240, cfg.rateLimitPerMin) }));

  r.get("/live", (req, res) => {
    if (court.watching() >= MAX_WATCHERS) return res.status(503).json({ error: { code: "unavailable" } });
    res.status(200).set({ "Content-Type": "text/event-stream", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" });
    res.flushHeaders();
    const stop = court.watch((s) => sse(res, "state", s));
    sse(res, "state", court.snapshot());
    const beat = setInterval(() => res.write(": still here\n\n"), HEARTBEAT_MS);
    res.on("close", () => { clearInterval(beat); stop(); });
  });

  r.post("/reset", wrap(async (req, res) => { res.json({ data: court.reset() }); }));
  r.post("/board/:id", wrap(async (req, res) => { res.json({ data: court.boardAction(idOf(req), checkCourtChange(body(req).action)) }); }));
  r.post("/pauses/:id", wrap(async (req, res) => { res.json({ data: court.pauseAction(idOf(req), checkCourtChange(body(req).action)) }); }));
  r.post("/pauses/:id/aid", wrap(async (req, res) => { res.json({ data: court.aidUpdate(idOf(req), checkCourtChange(body(req).update)) }); }));

  api.use("/court", r);
}
