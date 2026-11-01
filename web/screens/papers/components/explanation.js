// ---------- Plain-words explanation ----------
import { $, el } from "/web/shared/lib/dom.js";
import { t } from "/web/shared/lib/page-text.js";
import { state } from "/web/shared/state.js";
import { answerHtml } from "/web/shared/lib/answer-html.js";
import { ai, PERMANENT, errCopy, disableAi } from "/web/shared/ui/ai-helper.js";
import { addAdviceFlag, addDateFlag } from "/web/shared/ui/answer-flags.js";
import * as api from "/web/shared/api/client.js";

export async function explain() {
  const d = state.papers;
  if (!d || !ai.on) return;
  const out = $("explainOut");
  out.textContent = "";
  const card = el("div", "card");
  card.appendChild(el("h3", null, t("explain_h")));
  const body = el("div");
  body.appendChild(el("p", "thinking", t("thinking")));
  card.appendChild(body);
  out.appendChild(card);
  const btn = $("explainBtn");
  btn.disabled = true;
  try {
    const res = await api.stream("explain", { lang: state.lang, doc: { safe: d.safe } }, { onText: ({ text }) => { body.innerHTML = answerHtml(text, d.back); } });
    body.innerHTML = answerHtml(res.text, d.back);
    body.lang = state.lang;
    addAdviceFlag(card, res.text);
    addDateFlag(card, res.text, d.raw);
    if (res.truncated) card.appendChild(el("p", "small", t("truncated")));
  } catch (e) {
    if (e && PERMANENT.includes(e.code)) { out.textContent = ""; disableAi(); }
    else if (e && e.code !== "cancelled") { body.textContent = ""; card.appendChild(el("p", "warn", errCopy(e && e.code))); }
  } finally { if (ai.on) btn.disabled = false; }
}
