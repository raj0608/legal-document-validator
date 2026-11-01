// The "next date" reminders: a card on Home and a thin strip at the top of the other screens.
// The person should never have to open a screen to remember when they need to be in court.
import { $ } from "/web/shared/lib/dom.js";
import { t } from "/web/shared/lib/page-text.js";
import { state } from "/web/shared/state.js";
import { fmtDate, fmtShort, fmtTime } from "/web/shared/lib/date-format.js";
import { fromISO, dayDiff } from "/shared/dates/date-math.js";

const countdown = (diff) => (diff > 1 ? t("in_days", { n: diff }) : diff === 1 ? t("in_day") : t("is_today"));

export function renderNext() {
  const hearing = fromISO(state.dates.hearing);
  const upcoming = hearing && dayDiff(hearing) >= 0;
  const view = document.body.dataset.view;
  const at = state.dates.time ? " " + t("at_time", { t: fmtTime(state.dates.time) }) : "";
  const when = upcoming ? fmtDate(hearing) + at : "";

  // Home shows the card, My dates shows its own, every other screen shows the strip.
  $("nextStrip").hidden = !upcoming || view === "home" || view === "dates";
  if (upcoming) $("nextStripText").textContent = t("next_strip", { d: fmtShort(hearing) + at }) + " · " + countdown(dayDiff(hearing));

  $("nextCard").hidden = !upcoming;
  if (upcoming) {
    $("nextDate").textContent = when;
    $("nextSub").textContent = [countdown(dayDiff(hearing)), state.dates.place].filter(Boolean).join(". ");
  }
}
