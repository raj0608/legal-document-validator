// The dialog on 90-day pauses: a drafted docket entry or sealing order for the clerk; the three ways a pause ends;
// and, for the one chosen, what it means with its entry already drafted, so recording it is one more click (or Cancel).
import { $, el } from "/app/shared/lib/dom.js";
import { t } from "/app/shared/lib/page-text.js";
import { state } from "/app/shared/state.js";
import { draftBox, copyButton } from "/app/shared/ui/docket-draft.js";
import { pauseEntry, sealingOrder } from "/shared/court/docket-drafts.js";

// Each way a pause ends, as the name of its drafted entry.
export const CLOSING = { dismiss: "dismissed", agreement: "agreement", lift: "lifted" };
const stepName = (step) => ({ dismiss: t("act_dismiss"), agreement: t("act_agreement"), lift: t("act_lift") })[step];
const askTitle = (step) => ({ dismiss: t("ask_dismiss"), agreement: t("ask_agreement"), lift: t("ask_lift") })[step];
const askNote = (step) => ({ dismiss: t("ask_dismiss_note"), agreement: t("ask_agreement_note"), lift: t("ask_lift_note") })[step];

function button(label, cls, data) {
  const b = el("button", "btn" + (cls ? " " + cls : ""), label);
  b.type = "button";
  Object.assign(b.dataset, data);
  return b;
}

function open(title, p) {
  $("pauseDialogH").textContent = title;
  const body = $("pauseDialogBody");
  body.textContent = "";
  body.appendChild(el("p", "dlg-meta", p.landlord + " v. " + p.tenant));
  const d = $("pauseDialog");
  if (!d.open) d.showModal();
  $("pauseDialogH").focus();
  return body;
}

// kind: "day30" | "day60" | "dismissed" | "agreement" | "lifted" | "seal"
export function showDraft(p, kind) {
  const day = state.court.day;
  const body = open(kind === "seal" ? t("draft_seal_h") : t("draft_h"), p);
  body.appendChild(draftBox(kind === "seal" ? sealingOrder(p, p.closedOn, day) : pauseEntry(kind, p, day), { cause: p.cause }));
}

// The three ways a pause ends, each with what it means.
export function chooseEnding(p) {
  const body = open(t("end_h"), p);
  for (const step of Object.keys(CLOSING)) {
    const row = el("div", "end-choice");
    row.append(button(stepName(step), step === "lift" ? "danger" : "", { act: "ask:" + step, id: p.id, key: "ask-" + step }), el("p", "small", askNote(step)));
    body.appendChild(row);
  }
}

// One way chosen: what it means, its entry, and Record it or Cancel.
export function askToClose(p, step) {
  const body = open(askTitle(step), p);
  body.appendChild(el("p", step === "lift" ? "warn" : "dlg-note", askNote(step)));
  const yes = button(t("ask_record"), step === "lift" ? "danger-solid" : "primary", { act: "do:" + step, id: p.id });
  const no = button(t("ask_cancel"), "", { act: "cancel" });
  body.appendChild(draftBox(pauseEntry(CLOSING[step], p, state.court.day), { cause: p.cause, copy: false, extra: [yes, no] }));
}

// After "Record it": the buttons give way to Copy and a note that it is recorded.
export function markRecorded() {
  const body = $("pauseDialogBody");
  const row = body.querySelector(".draft-row"), ta = body.querySelector(".draft textarea");
  if (!row || !ta) return;
  const done = el("div", "dlg-row draft-row");
  done.append(copyButton(ta), el("span", "recorded", t("recorded")));
  row.replaceWith(done);
}
