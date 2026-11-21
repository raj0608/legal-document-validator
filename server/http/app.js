// The web server: static files for the page, and a small API that calls the AI.
// Nothing about a request is stored: no database, no files, no request bodies in logs. The court staff pages keep
// their shared board in memory (made-up cases from the docket passed in), and it is gone when the server stops.
import express from "express";
import { securityHeaders } from "./security-headers.js";
import { requestLog } from "./request-log.js";
import { perMinuteLimit, createDailyCap } from "./limits.js";
import { addHealthRoute, addAiRoutes } from "./routes.js";
import { addCitationRoutes } from "./citation-routes.js";
import { addNoticeRoutes } from "./notice-routes.js";
import { addCourtRoutes } from "./court-routes.js";
import { createLiveCourt } from "../court/live-court.js";
import { notFound, errorHandler } from "./error-responses.js";
import { servePage } from "./serve-page.js";
import { serveStaticFiles } from "./static-files.js";

export function createApp({ ai = null, citations = null, docket = null, config = {} } = {}) {
  const cfg = { rateLimitPerMin: 20, dailyCap: 2000, log: true, trustProxy: undefined, demo: false, now: () => new Date(), ...config };
  const app = express();
  app.disable("x-powered-by");
  if (cfg.trustProxy !== undefined) app.set("trust proxy", cfg.trustProxy);

  app.use(securityHeaders());
  app.use(requestLog(cfg));

  const api = express.Router();
  api.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  addHealthRoute(api, { ai, cfg });

  api.use(express.json({ limit: "256kb" }));
  // A body that is not JSON (a form, plain text, nothing) leaves req.body empty: treat it as an empty object, so the routes refuse it with a plain
  // "bad request" and not a server error.
  api.use((req, res, next) => { if (!req.body || typeof req.body !== "object") req.body = {}; next(); });
  // The court staff pages: in front of the AI's per-minute limit, with a higher one of their own (a board is many quick taps).
  if (docket) addCourtRoutes(api, { court: createLiveCourt({ docket, now: () => cfg.now().getTime() }), cfg });
  api.use(perMinuteLimit(cfg));
  const spend = createDailyCap(cfg);
  addAiRoutes(api, { ai, spend });
  addCitationRoutes(api, { citations, spend });
  addNoticeRoutes(api, { now: cfg.now });

  api.use(notFound);
  api.use(errorHandler);
  app.use("/api", api);

  app.use(servePage);
  serveStaticFiles(app);
  return app;
}
