// Whether the AI helper is available, and how its errors are shown.
import { $ } from "/web/shared/lib/dom.js";
import { t } from "/web/shared/lib/page-text.js";
import * as api from "/web/shared/api/client.js";

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
