// Hearing day (#court/hearings): this morning's eviction docket, live on every staff screen. Bailiffs check people in,
// the judge calls the next case in line and records how it ended, and the clerk gets the docket entry drafted.
import { $ } from "/app/shared/lib/dom.js";
import { t } from "/app/shared/lib/page-text.js";
import { state } from "/app/shared/state.js";
import { courtChange } from "/app/shared/api/client.js";
import { onCourtChange, setCourt } from "/app/shared/api/court-feed.js";
import { toast } from "/app/shared/ui/toast.js";
import { redrawKeepingFocus } from "/app/shared/lib/keep-focus.js";
import { fmtDate } from "/app/shared/lib/date-format.js";
import { fromISO } from "/shared/dates/date-math.js";
import { drawNow, drawLanes } from "/app/court/hearings/components/board-lanes.js";
import { openCase, drawCase, setDrafting, initCaseDialog } from "/app/court/hearings/components/case-dialog.js";

// A button's data-act as the change the server takes. A toggle asks for the opposite of what the case has now.
function toAction(act, c) {
  const [type, arg] = act.split(":");
  if (type === "arrive") return { type, party: arg, here: !c[arg + "Here"] };
  if (type === "talk") return { type, with: arg };
  if (type === "outcome") return { type, outcome: arg };
  if (type === "advised") return { type, value: !c.advised };
  return { type };
}

export function renderHearings() {
  const s = state.court;
  $("boardDown").hidden = !state.courtDown;
  $("boardDay").textContent = s ? t("board_day", { date: fmtDate(fromISO(s.day)) }) : t("live_loading");
  redrawKeepingFocus($("boardNow"), drawNow);
  redrawKeepingFocus($("boardLanes"), drawLanes);
  redrawKeepingFocus($("caseDialog"), drawCase, $("caseDialogH"));
}

async function change(id, act, button) {
  const c = state.court && state.court.board.find((x) => x.id === id);
  if (!c) return;
  button.disabled = true;
  try { setCourt(await courtChange("board/" + id, { action: toAction(act, c) })); }
  catch (e) { toast(e && e.code === "bad_request" ? t("live_conflict") : t("live_error")); }
  button.disabled = false;
}

function onClick(e) {
  const b = e.target.closest("button[data-open], button[data-act]");
  if (!b || b.disabled) return;
  if (b.dataset.open) return openCase(b.dataset.open);
  const act = b.dataset.act;
  if (act === "close") return $("caseDialog").close();
  if (act.startsWith("draft:")) return setDrafting(act.slice(6));
  return change(b.dataset.id, act, b);
}

export function initHearings() {
  initCaseDialog();
  onCourtChange(renderHearings);
  for (const id of ["boardNow", "boardLanes", "caseDialog"]) $(id).addEventListener("click", onClick);
  $("boardReset").addEventListener("click", async () => {
    try { setCourt(await courtChange("reset", {})); toast(t("board_reset_done")); } catch (e) { toast(t("live_error")); }
  });
  // Leaving the page closes an open case, so a dialog never stays over another page.
  window.addEventListener("hashchange", () => { if ($("caseDialog").open) $("caseDialog").close(); });
  // Keep each case's waiting time current while the board shows.
  setInterval(() => { if (document.body.dataset.view === "hearings" && state.court) renderHearings(); }, 30000);
}
