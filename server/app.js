// The web server: static files for the page, and a small API that calls the AI.
// Nothing about a request is stored: no database, no files, no request bodies in logs.
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { ApiError, bad } from "./errors.js";
import { mapError } from "./anthropic.js";
import { checkDoc, checkTurns, parseLang } from "./checks.js";
import { documentRequest, chatRequest, newNonce } from "./prompts.js";
import { createTranslator } from "./translate.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function createApp({ ai = null, config = {} } = {}) {
  const cfg = { rateLimitPerMin: 20, dailyCap: 2000, log: true, trustProxy: undefined, demo: false, ...config };
  const app = express();
  app.disable("x-powered-by");
  if (cfg.trustProxy !== undefined) app.set("trust proxy", cfg.trustProxy);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Everything the page needs is served from this site: no third party sees a visit.
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        styleSrcAttr: ["'unsafe-inline'"], // a few style="" attributes in the page
        fontSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        workerSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: null
      }
    }
  }));

  // Request log: method, path, status, time, token counts. Never bodies.
  app.use((req, res, next) => {
    if (!cfg.log) return next();
    const t0 = Date.now();
    res.on("finish", () => {
      const u = res.locals.usage;
      console.log(`${req.method} ${req.originalUrl.split("?")[0]} ${res.statusCode} ${Date.now() - t0}ms` + (u ? ` in=${u.input_tokens} out=${u.output_tokens}` : ""));
    });
    next();
  });

  const api = express.Router();
  api.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  api.get("/health", (req, res) => res.json({ ok: true, ai: Boolean(ai), demo: cfg.demo, ...(ai && ai.provider ? { provider: ai.provider } : {}) }));

  api.use(express.json({ limit: "256kb" }));
  api.use(rateLimit({
    windowMs: 60_000, limit: cfg.rateLimitPerMin, standardHeaders: "draft-7", legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ error: { code: "rate_limited" } })
  }));

  // A global daily ceiling on AI calls, so a runaway script cannot run up the bill. In memory only.
  let day = "", used = 0;
  function spend() {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== day) { day = today; used = 0; }
    if (++used > cfg.dailyCap) throw new ApiError("rate_limited", 429);
  }
  function needAi() {
    if (!ai) throw new ApiError("unavailable", 503);
    spend();
  }

  const sendError = (res, e) => {
    const err = mapError(e);
    if (res.headersSent) { // already streaming: report the failure as an event
      if (err.code !== "cancelled") sse(res, "error", { code: err.code, text: err.text || "" });
      return res.end();
    }
    res.status(err.status).json({ error: { code: err.code } });
  };
  const wrap = (fn) => async (req, res) => { try { await fn(req, res); } catch (e) { sendError(res, e); } };
  const abortOnClose = (res) => {
    const ac = new AbortController();
    res.on("close", () => { if (!res.writableFinished) ac.abort(); });
    return ac;
  };
  const sse = (res, event, data) => res.write("event: " + event + "\ndata: " + JSON.stringify(data) + "\n\n");

  // Streaming answers (plain-words explanation, chat): server-sent events.
  async function streamTask(res, req) {
    const ac = abortOnClose(res);
    res.status(200).set({ "Content-Type": "text/event-stream", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" });
    res.flushHeaders();
    const r = await ai.stream({ ...req, signal: ac.signal, onText: (t) => sse(res, "text", { t }) });
    res.locals.usage = r.usage;
    sse(res, "done", { truncated: r.truncated });
    res.end();
  }
  async function jsonTask(res, req) {
    const ac = abortOnClose(res);
    const r = await ai.json({ ...req, signal: ac.signal });
    res.locals.usage = r.usage;
    res.json({ data: r.data });
  }

  api.post("/explain", wrap(async (req, res) => {
    const lang = parseLang(req.body.lang), text = checkDoc(req.body.doc);
    needAi();
    await streamTask(res, documentRequest("explain", lang, text, newNonce()));
  }));
  api.post("/chat", wrap(async (req, res) => {
    const lang = parseLang(req.body.lang), turns = checkTurns(req.body.turns), text = checkDoc(req.body.doc, { required: false });
    needAi();
    await streamTask(res, chatRequest(lang, text, turns, newNonce()));
  }));
  api.post("/blanks", wrap(async (req, res) => {
    const lang = parseLang(req.body.lang), text = checkDoc(req.body.doc);
    needAi();
    await jsonTask(res, documentRequest("blanks", lang, text, newNonce()));
  }));
  api.post("/clerk", wrap(async (req, res) => {
    const lang = parseLang(req.body.lang), text = checkDoc(req.body.doc);
    needAi();
    await jsonTask(res, documentRequest("clerk", lang, text, newNonce()));
  }));

  const translator = ai ? createTranslator(ai) : null;
  api.post("/translate", wrap(async (req, res) => {
    const lang = parseLang(req.body.lang);
    if (lang === "en" || lang === "es") throw bad("built in");
    needAi();
    const ac = abortOnClose(res);
    res.json(await translator(lang, ac.signal));
  }));

  api.use((req, res) => res.status(404).json({ error: { code: "not_found" } }));
  // eslint-disable-next-line no-unused-vars
  api.use((err, req, res, next) => {
    if (err && err.type === "entity.too.large") return res.status(413).json({ error: { code: "prompt_too_large" } });
    if (err && err.status >= 400 && err.status < 500) return res.status(400).json({ error: { code: "bad_request" } });
    console.error("unexpected error:", err && err.name); // the name only: messages could echo user text
    res.status(500).json({ error: { code: "generic" } });
  });
  app.use("/api", api);

  // Libraries and the font come from the npm packages, pinned in package.json, not from a CDN.
  const vendor = (dir) => express.static(path.join(root, "node_modules", dir), { maxAge: "1d", index: false, dotfiles: "ignore" });
  // pdf.js: its files, plus character maps (PDFs in Chinese, Japanese, Korean), image decoders, colour profiles and standard fonts
  for (const dir of ["cmaps", "wasm", "iccs", "standard_fonts"]) app.use("/vendor/pdfjs/" + dir, vendor("pdfjs-dist/" + dir));
  app.use("/vendor/pdfjs", vendor("pdfjs-dist/build"));
  app.use("/vendor/fonts", vendor("@fontsource/atkinson-hyperlegible"));
  app.use("/shared", express.static(path.join(root, "shared")));
  app.use(express.static(path.join(root, "public")));
  return app;
}
