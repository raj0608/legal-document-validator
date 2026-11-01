// "My papers": the plain-words explanation, dates and laws found in the paper, and the chat.
import { $, el } from "/web/shared/lib/dom.js";
import { t } from "/web/shared/lib/page-text.js";
import { state } from "/web/shared/state.js";
import { fmtDate, fmtTime } from "/web/shared/lib/date-format.js";
import { toast } from "/web/shared/ui/toast.js";
import { answerHtml } from "/web/shared/lib/answer-html.js";
import { findDates } from "/shared/analysis/paper-dates.js";
import { findCites } from "/shared/analysis/citations.js";
import { toISO, dayDiff } from "/shared/dates/date-math.js";
import { looksLikeInjection } from "/shared/safety/injection-filter.js";
import { unredact, redactText, createTokenState } from "/shared/safety/redaction.js";
import { ai, PERMANENT, errCopy, disableAi } from "/web/shared/ui/ai-helper.js";
import { addAdviceFlag, addDateFlag } from "/web/shared/ui/answer-flags.js";
import * as api from "/web/shared/api/client.js";
import { registerSlot, currentExtraNames } from "/web/shared/ui/document-slot.js";
import { renderDates } from "/web/screens/dates/screen.js";
import { refreshStepControls } from "/web/shared/layout/router.js";

// ---------- Dates and laws found in the paper (no AI) ----------
function autoDatesFromPapers() {
  const d = state.papers;
  if (!d) return;
  const hearings = findDates(d.raw).filter((x) => x.hearingLike);
  if (hearings.length === 1 && dayDiff(hearings[0].date) >= -1) {
    const h = hearings[0];
    state.dates.hearing = toISO(h.date);
    state.dates.time = h.time || state.dates.time;
    if (h.place) state.dates.place = h.place;
    state.dates.fromPaper = true;
    renderDates();
    toast(t("auto_added"));
  }
}

export function renderFound() {
  const d = state.papers;
  if (!d) return;
  const ul = $("foundDates");
  ul.textContent = "";
  const dates = findDates(d.raw);
  if (!dates.length) ul.appendChild(el("li", null, t("dates_none")));
  dates.forEach((x) => {
    const li = el("li");
    li.append(el("mark", null, fmtDate(x.date) + (x.time ? " " + t("at_time", { t: fmtTime(x.time) }) : "")), el("span", "ctx", x.ctx));
    if (x.hearingLike || dates.length === 1) {
      const b = el("button", "link-btn", t("use_hearing")); b.type = "button";
      b.addEventListener("click", () => {
        state.dates.hearing = toISO(x.date);
        if (x.time) state.dates.time = x.time;
        if (x.place) state.dates.place = x.place;
        state.dates.fromPaper = true;
        renderDates();
        toast(t("added"));
      });
      li.appendChild(b);
    }
    ul.appendChild(li);
  });
  const cl = $("foundCites");
  cl.textContent = "";
  const cites = findCites(d.raw);
  if (!cites.length) cl.appendChild(el("li", null, t("cites_none")));
  cites.forEach((c) => {
    const li = el("li");
    const a = el("a", null, c.kind === "kind_case" ? t("search_case") : t("open_source"));
    a.href = c.url; a.target = "_blank"; a.rel = "noopener";
    li.append(el("span", "cite-text", c.label), el("span", "badge", t("not_checked")), el("span", "ctx", t(c.kind)), a);
    cl.appendChild(li);
  });
}

// ---------- Chat ----------
let ctl = null;
export const abortChat = () => { if (ctl) ctl.abort(); };

function resetChat() {
  state.turns = [];
  state.chatTokens = null;
  $("thread").textContent = "";
  $("explainOut").textContent = "";
}
registerSlot("papers", {
  onLoad() {
    resetChat(); autoDatesFromPapers(); renderFound(); refreshStepControls();
    $("papersNext1").focus(); // the next thing to do, and it scrolls into view on a phone
  },
  onRemove() { resetChat(); refreshStepControls(); }
});

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

async function ask(question) {
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

// ---------- Plain-words explanation ----------
async function explain() {
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

export function initPapers() {
  $("explainBtn").addEventListener("click", explain);
  $("askBtn").addEventListener("click", () => ask($("askInput").value));
  $("askInput").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask($("askInput").value); } });
  $("stopBtn").addEventListener("click", abortChat);
}
