// 90-day pauses (#court/diversion): every case paused in the Pre-Eviction Diversion Program, with its conference dates,
// the rental-aid agency's updates as they arrive, and one click from a step to its drafted docket entry.
import { $, el } from "/app/shared/lib/dom.js";
import { t } from "/app/shared/lib/page-text.js";
import { state } from "/app/shared/state.js";
import { courtChange } from "/app/shared/api/client.js";
import { onCourtChange, setCourt, courtNow } from "/app/shared/api/court-feed.js";
import { toast } from "/app/shared/ui/toast.js";
import { redrawKeepingFocus } from "/app/shared/lib/keep-focus.js";
import { aidName } from "/app/shared/lib/aid-words.js";
import { dueThisWeek, byUrgency } from "/shared/court/pause-schedule.js";
import { needsSealing } from "/shared/court/pause-case.js";
import { pauseCard } from "/app/court/diversion/components/pause-card.js";
import { showDraft, chooseEnding, askToClose, markRecorded, CLOSING } from "/app/court/diversion/components/pause-dialog.js";

const lastAid = new Map(); // the newest agency update this screen has seen for each case

function drawWeek(s) {
  const box = $("pausesWeek");
  box.textContent = "";
  const w = dueThisWeek(s.pauses, s.day);
  box.appendChild(el("h2", null, t("week_h")));
  const row = el("p", "chips-row");
  row.append(el("span", "week-chip", t("week_conf", { n: w.conferences })), el("span", "week-chip", t("week_end", { n: w.ending })),
    el("span", "week-chip", t("week_seal", { n: s.pauses.filter(needsSealing).length })));
  box.appendChild(row);
}

function drawList(id, list, s, now) {
  const ul = $(id);
  ul.textContent = "";
  if (!list.length) ul.appendChild(el("li", "lane-empty", t("sec_none")));
  list.forEach((p) => ul.appendChild(pauseCard(p, s.day, now)));
}

// A rental-aid update that arrived since this screen last drew: say so once, if the page shows.
function announce(s) {
  let fresh = null;
  for (const p of s.pauses) {
    const at = p.aid ? p.aid.at : 0;
    if (lastAid.has(p.id) && at > lastAid.get(p.id)) fresh = p;
    lastAid.set(p.id, at);
  }
  if (fresh && document.body.dataset.view === "diversion") {
    toast(t("aid_toast", { agency: fresh.aid.by, status: aidName(fresh.aid.status), names: fresh.landlord + " v. " + fresh.tenant }));
  }
}

export function renderPauses() {
  const s = state.court;
  $("pausesDown").hidden = !state.courtDown;
  if (!s) return;
  announce(s);
  const now = courtNow();
  redrawKeepingFocus($("view-diversion"), () => {
    drawWeek(s);
    drawList("pausesActive", byUrgency(s.pauses.filter((p) => p.state === "paused"), s.day), s, now);
    drawList("pausesResolved", s.pauses.filter((p) => p.state === "resolved"), s, now);
    drawList("pausesLifted", s.pauses.filter((p) => p.state === "lifted"), s, now);
  });
}

// A button's data-act as the change the server takes.
function toAction(act) {
  const [type, which, how] = act.split(":");
  if (type === "conf") return { type: "conference", which, how };
  if (type === "do") return { type: which };
  return { type };
}

async function record(act, p, b) {
  b.disabled = true;
  try {
    const s = await courtChange("pauses/" + p.id, { action: toAction(act) });
    setCourt(s);
    const after = s.pauses.find((x) => x.id === p.id);
    if (act.startsWith("conf:")) showDraft(after, act.split(":")[1]); // one click: the conference is recorded and its entry drafted
    else if (act.startsWith("do:")) markRecorded();
    else toast(t("sealed_done"));
  } catch (e) { toast(e && e.code === "bad_request" ? t("live_conflict") : t("live_error")); }
  b.disabled = false;
}

function onClick(e) {
  const b = e.target.closest("button[data-act]");
  if (!b || b.disabled || !state.court) return;
  const act = b.dataset.act;
  if (act === "cancel") return $("pauseDialog").close();
  const p = state.court.pauses.find((x) => x.id === b.dataset.id);
  if (!p) return;
  if (act.startsWith("draft:")) return showDraft(p, act.slice(6));
  if (act === "end") return chooseEnding(p);
  if (act.startsWith("ask:") && CLOSING[act.slice(4)]) return askToClose(p, act.slice(4));
  return record(act, p, b);
}

export function initPauses() {
  onCourtChange(renderPauses);
  $("view-diversion").addEventListener("click", onClick);
  $("pauseDialogClose").addEventListener("click", () => $("pauseDialog").close());
  // Leaving the page closes the dialog, so it never stays over another page.
  window.addEventListener("hashchange", () => { if ($("pauseDialog").open) $("pauseDialog").close(); });
}
