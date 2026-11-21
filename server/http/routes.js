// The /api routes: health, and the AI routes, which check each request before anything goes to the AI.
import { ApiError, bad } from "../errors.js";
import { checkDoc, checkTurns, parseLang } from "../checks.js";
import { documentRequest, chatRequest, newNonce } from "../prompts.js";
import { createTranslator } from "../translate.js";
import { asksForAdvice } from "../../shared/safety/advice-question.js";
import { I18N } from "../../shared/i18n/languages.js";
import { abortOnClose, createTasks, sse } from "./streaming.js";
import { wrap } from "./error-responses.js";

// The fixed reply, in the same shape as a streamed answer so the page shows it like any other.
function adviceRefusal(res, text) {
  res.status(200).set({ "Content-Type": "text/event-stream", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" });
  sse(res, "text", { t: text });
  sse(res, "done", { truncated: false, gated: true });
  res.end();
}

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
    // A question that asks what to do in the person's own case is answered with a fixed refusal and pointers to free help, and the AI is
    // never asked: no tokens, no chance of advice. English and Spanish only (see shared/safety/advice-question.js); other languages go on to the AI.
    if ((lang === "en" || lang === "es") && asksForAdvice(turns.at(-1).content)) return adviceRefusal(res, I18N[lang].advice_gate);
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
