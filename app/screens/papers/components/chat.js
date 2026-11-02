// ---------- Chat ----------
import { $, el } from "/app/shared/lib/dom.js";
import { t } from "/app/shared/lib/page-text.js";
import { state } from "/app/shared/state.js";
import { answerHtml } from "/app/shared/lib/answer-html.js";
import { looksLikeInjection } from "/shared/safety/injection-filter.js";
import { redactText, createTokenState } from "/shared/safety/redaction.js";
import { ai, PERMANENT, errCopy, disableAi } from "/app/shared/ui/ai-helper.js";
import { addAdviceFlag, addDateFlag } from "/app/shared/ui/answer-flags.js";
import * as api from "/app/shared/api/client.js";
import { currentExtraNames } from "/app/shared/ui/document-slot.js";

let ctl = null;
export const abortChat = () => { if (ctl) ctl.abort(); };

export function resetChat() {
  state.turns = [];
  state.chatTokens = null;
  $("thread").textContent = "";
  $("explainOut").textContent = "";
}

export function renderQuick() {
  const box = $("quick");
  box.textContent = "";
  ["q1", "q2", "q3", "q4", "q5"].forEach((k) => {
    const b = el("button", "chip", t(k)); b.type = "button";
    b.addEventListener("click", () => ask(t(k)));
    box.appendChild(b);
  });
}
function addMsg(role, text, back) {
  const li = el("li", "msg " + (role === "user" ? "you" : "bot"));
  li.appendChild(el("span", "who", role === "user" ? t("you") : t("helper")));
  const body = el("div");
  if (role === "user") body.textContent = text; else body.innerHTML = answerHtml(text, back);
  li.appendChild(body);
  if (role !== "user") li.lang = state.lang;
  $("thread").appendChild(li);
  return { li, body };
}
function setBusy(b) {
  $("askBtn").disabled = b || !ai.on;
  $("stopBtn").hidden = !b;
  document.querySelectorAll("#quick .chip").forEach((x) => { x.disabled = b; });
}

export async function ask(question) {
  const q = (question || "").trim();
  if (!q) return;
  if (!ai.on) { $("chatOff").hidden = false; return; }
  $("askInput").value = "";
  addMsg("user", q);
  if (looksLikeInjection(q)) { const { li } = addMsg("assistant", ""); li.appendChild(el("p", "warn", t("blocked_q"))); return; }
  // The question is redacted with the same token numbers as the paper, so nothing it adds can be mistaken for the paper's details.
  const tokens = state.papers ? state.papers.tokens : (state.chatTokens || (state.chatTokens = createTokenState()));
  const back = tokens.back;
  const safeQ = redactText(q, tokens, { extraNames: currentExtraNames() });
  state.turns.push({ role: "user", content: safeQ });
  const { li, body } = addMsg("assistant", "", back);
  body.innerHTML = "";
  body.appendChild(el("p", "thinking", t("thinking")));
  li.scrollIntoView({ block: "nearest" });
  setBusy(true);
  ctl = new AbortController();
  try {
    const res = await api.stream("chat", {
      lang: state.lang,
      doc: state.papers ? { safe: state.papers.safe } : null,
      turns: state.turns.slice(-10)
    }, { signal: ctl.signal, onText: ({ text }) => { body.innerHTML = answerHtml(text, back); } });
    body.innerHTML = answerHtml(res.text, back);
    state.turns.push({ role: "assistant", content: res.text });
    addAdviceFlag(li, res.text);
    addDateFlag(li, res.text, state.papers && state.papers.raw);
    if (res.truncated) li.appendChild(el("p", "small", t("truncated")));
  } catch (e) {
    const code = e && e.code;
    if (e && e.text) body.innerHTML = answerHtml(e.text, back); else body.textContent = "";
    if (code === "cancelled") { if (!e.text) li.remove(); }
    else if (PERMANENT.includes(code)) { li.remove(); disableAi(); }
    else li.appendChild(el("p", "warn", errCopy(code)));
    if (e && e.text) state.turns.push({ role: "assistant", content: e.text });
    else if (state.turns.length && state.turns[state.turns.length - 1].role === "user") state.turns.pop();
  } finally { setBusy(false); ctl = null; }
}
