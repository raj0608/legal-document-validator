// One case's controls, in a dialog: check-in, who they are talking with, the line for the judge, how the hearing ended,
// and the drafts for the clerk. It redraws when the case changes on any screen, except while a draft shows,
// so a change elsewhere never wipes out the clerk's edits.
import { $, el } from "/app/shared/lib/dom.js";
import { t } from "/app/shared/lib/page-text.js";
import { state } from "/app/shared/state.js";
import { courtNow } from "/app/shared/api/court-feed.js";
import { draftBox } from "/app/shared/ui/docket-draft.js";
import { PARTIES, TALK_WITH, OUTCOMES, waitedMinutes } from "/shared/court/hearing-board.js";
import { hearingEntry, sealingOrder } from "/shared/court/docket-drafts.js";
import { laneName, talkName, outcomeName, partyName, names } from "/app/court/hearings/lib/board-words.js";

let openId = null;
let drafting = null; // "entry" or "seal" while a draft shows

const current = () => (state.court && openId ? state.court.board.find((c) => c.id === openId) : null);

function button(label, act, { cls = "", pressed } = {}) {
  const b = el("button", "btn" + (cls ? " " + cls : ""), label);
  b.type = "button";
  b.dataset.act = act;
  b.dataset.id = openId;
  b.dataset.key = "dlg-" + act;
  if (pressed !== undefined) b.setAttribute("aria-pressed", String(pressed));
  return b;
}

// A labelled row of buttons.
function group(label, buttons) {
  const g = el("div", "dlg-group");
  g.setAttribute("role", "group");
  g.setAttribute("aria-label", label);
  const p = el("p", "dlg-label", label);
  p.setAttribute("aria-hidden", "true");
  const row = el("div", "dlg-row");
  row.append(...buttons);
  g.append(p, row);
  return g;
}

function drawControls(body, c) {
  if (["waiting", "here", "talking", "ready"].includes(c.stage)) {
    body.appendChild(group(t("dlg_who"), PARTIES.map((p) => button(partyName(p), "arrive:" + p, { pressed: Boolean(c[p + "Here"]) }))));
    if (c.stage !== "waiting") body.appendChild(group(t("dlg_talk"), TALK_WITH.map((w) => button(talkName(w), "talk:" + w, { pressed: c.stage === "talking" && c.with === w }))));
    const next = c.stage === "here" || c.stage === "talking" ? [button(t("act_ready"), "ready", { cls: "primary" })] : [];
    body.appendChild(group(t("dlg_next"), next.concat(button(t("act_call"), "call"))));
  }
  if (c.stage === "hearing") {
    body.appendChild(group(t("dlg_advice"), [button(t("act_advised"), "advised", { pressed: Boolean(c.advised) })]));
    body.appendChild(group(t("dlg_outcome"), OUTCOMES.map((o) => button(outcomeName(o), "outcome:" + o, { cls: o === "diversion" ? "primary" : "" }))));
  }
  if (c.stage === "done") {
    if (c.outcome === "dismissed") body.appendChild(el("p", "seal-flag", t("seal_flag")));
    if (c.outcome === "diversion") body.appendChild(el("p", "dlg-note", t("to_pauses")));
    const acts = [button(t("act_draft"), "draft:entry", { cls: "primary" })];
    if (c.outcome === "dismissed") acts.push(button(t("act_draft_seal"), "draft:seal"));
    body.appendChild(group(t("dlg_clerk"), acts.concat(button(t("act_reopen"), "reopen"))));
  }
}

function drawDraft(body, c) {
  const day = state.court.day;
  body.appendChild(el("h3", "dlg-sub", drafting === "seal" ? t("draft_seal_h") : t("draft_h")));
  const text = drafting === "seal" ? sealingOrder(c, day, day) : hearingEntry(c, day);
  body.appendChild(draftBox(text, { extra: [button(t("act_back"), "draft:back")] })); // the line above already names the case
}

export function drawCase(force) {
  const d = $("caseDialog");
  if (!d.open || (drafting && !force)) return;
  const c = current();
  if (!c) { d.close(); return; }
  $("caseDialogH").textContent = names(c);
  const body = $("caseDialogBody");
  body.textContent = "";
  const meta = [c.cause, c.stage === "done" ? outcomeName(c.outcome) : laneName(c.stage)];
  if (c.stage !== "done") meta.push(t("waited", { n: waitedMinutes(c, courtNow()) }));
  body.appendChild(el("p", "dlg-meta", meta.join(" · ")));
  if (drafting) drawDraft(body, c); else drawControls(body, c);
}

export function openCase(id) {
  openId = id;
  drafting = null;
  const d = $("caseDialog");
  if (!d.open) d.showModal();
  drawCase(true);
  $("caseDialogH").focus();
}

// "entry" or "seal" shows that draft; "back" returns to the controls.
export function setDrafting(kind) {
  drafting = kind === "back" ? null : kind;
  drawCase(true);
  $("caseDialogH").focus();
}

export function initCaseDialog() {
  $("caseDialog").addEventListener("close", () => { openId = null; drafting = null; });
}
