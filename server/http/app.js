// The web server: static files for the page, and a small API that calls the AI.
// Nothing about a request is stored: no database, no files, no request bodies in logs.
import express from "express";
import { securityHeaders } from "./security-headers.js";
import { requestLog } from "./request-log.js";
import { perMinuteLimit, createDailyCap } from "./limits.js";
import { addHealthRoute, addAiRoutes } from "./routes.js";
import { addCitationRoutes } from "./citation-routes.js";
import { notFound, errorHandler } from "./error-responses.js";
import { servePage } from "./serve-page.js";
import { serveStaticFiles } from "./static-files.js";

export function createApp({ ai = null, citations = null, config = {} } = {}) {
  const cfg = { rateLimitPerMin: 20, dailyCap: 2000, log: true, trustProxy: undefined, demo: false, ...config };
  const app = express();
  app.disable("x-powered-by");
  if (cfg.trustProxy !== undefined) app.set("trust proxy", cfg.trustProxy);

  app.use(securityHeaders());
  app.use(requestLog(cfg));

  const api = express.Router();
  api.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  addHealthRoute(api, { ai, cfg });

  api.use(express.json({ limit: "256kb" }));
  api.use(perMinuteLimit(cfg));
  const spend = createDailyCap(cfg);
  addAiRoutes(api, { ai, spend });
  addCitationRoutes(api, { citations, spend });

  api.use(notFound);
  api.use(errorHandler);
  app.use("/api", api);

  app.use(servePage);
  serveStaticFiles(app);
  return app;
}
