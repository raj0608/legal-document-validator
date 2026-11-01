// The /api routes: health, and the AI routes, which check each request before anything goes to the AI.
import { ApiError, bad } from "../errors.js";
import { checkDoc, checkTurns, parseLang } from "../checks.js";
import { documentRequest, chatRequest, newNonce } from "../prompts.js";
import { createTranslator } from "../translate.js";
import { abortOnClose, createTasks } from "./streaming.js";
import { wrap } from "./error-responses.js";

export function addHealthRoute(api, { ai, cfg }) {
  api.get("/health", (req, res) => res.json({ ok: true, ai: Boolean(ai), demo: cfg.demo, ...(ai && ai.provider ? { provider: ai.provider } : {}) }));
}

export function addAiRoutes(api, { ai, spend }) {
  const { streamTask, jsonTask } = createTasks(ai);
  function needAi() {
    if (!ai) throw new ApiError("unavailable", 503);
    spend();
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
}
