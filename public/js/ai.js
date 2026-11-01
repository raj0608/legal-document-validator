// Whether the AI helper is available, and how its errors and replies are shown.
import { $, el, t } from "./core.js";
import { looksLikeAdvice } from "/shared/safety/advice.js";
import { unsupportedDates, allowedDates } from "/shared/answer-dates.js";
import * as api from "./api-client.js";

export const ai = { on: false, demo: false };
// The server says "unavailable" when it has no working key. That cannot be fixed by trying again.
export const PERMANENT = ["unavailable"];
const AI_BUTTONS = ["explainBtn", "blanksBtn", "clerkBtn", "askBtn"];

export function errCopy(code) {
  if (code === "rate_limited") return t("err_rate");
  if (code === "refused") return t("err_refused");
  if (code === "prompt_too_large") return t("err_big");
  if (code === "invalid_json") return t("err_json");
  if (code === "pii_detected") return t("err_pii");
  return t("err_generic");
}

export function disableAi() {
  ai.on = false;
  $("chatOff").hidden = false;
  $("explainOff").hidden = false;
  AI_BUTTONS.forEach((id) => { $(id).disabled = true; });
}

export async function initAi() {
  const h = await api.health();
  ai.on = h.ai; ai.demo = h.demo;
  $("demoBar").hidden = !h.demo;
  if (!ai.on) disableAi();
  else AI_BUTTONS.forEach((id) => { $(id).disabled = false; });
}

// A date in an answer that is not in the paper was worked out by the AI, which it is told never to do. Say so.
export function addDateFlag(container, text, paperText) {
  const extra = unsupportedDates(text, allowedDates(paperText));
  if (extra.length) container.appendChild(el("p", "warn flag", t("date_flag", { x: extra.join(", ") })));
}

// Replies are shown as they are. A reply with should/must-style words gets a warning under it.
export function addAdviceFlag(container, text) {
  if (looksLikeAdvice(text)) container.appendChild(el("p", "warn flag", t("advice_flag")));
}
