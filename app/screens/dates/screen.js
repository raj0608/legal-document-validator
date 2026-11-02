// "My dates": the date fields and the hearing card. The timeline, the reminder preview and the saved files are its components.
import { $ } from "/app/shared/lib/dom.js";
import { t } from "/app/shared/lib/page-text.js";
import { state } from "/app/shared/state.js";
import { fmtDate, fmtTime } from "/app/shared/lib/date-format.js";
import { renderNext } from "/app/shared/layout/next-date.js";
import { dayDiff, fromISO } from "/shared/dates/date-math.js";
import { items } from "/app/screens/dates/lib/date-items.js";
import { renderTimeline } from "/app/screens/dates/components/timeline.js";
import { initReminderPreview } from "/app/screens/dates/components/reminder-preview.js";
import { initDateFiles } from "/app/screens/dates/components/date-files.js";

export function renderDates() {
  $("fNotice").value = state.dates.notice; $("fDays").value = state.dates.days; $("fServed").value = state.dates.served;
  $("fHearing").value = state.dates.hearing; $("fTime").value = state.dates.time; $("fPlace").value = state.dates.place;
  if (state.dates.notice || state.dates.served) $("otherDates").open = true;
  const all = items();
  const upcoming = all.some((it) => dayDiff(it.date) >= 0);
  $("noDates").hidden = all.length > 0;
  $("saveDates").hidden = !all.length;
  $("icsBox").hidden = !upcoming;
  renderTimeline($("dateList"), all);
  $("flowRem").hidden = !upcoming; // step 3: only when there is something to be reminded about
  renderTimeline($("flowDateList"), all, { upcomingOnly: true });
  const hearing = fromISO(state.dates.hearing);
  $("hearingCard").hidden = !hearing;
  if (hearing) {
    const diff = dayDiff(hearing);
    $("hcDate").textContent = fmtDate(hearing);
    $("hcFrom").hidden = !state.dates.fromPaper;
    const parts = [diff > 1 ? t("in_days", { n: diff }) : diff === 1 ? t("in_day") : diff === 0 ? t("is_today") : t("was_past")];
    if (state.dates.time) parts.push(t("at_time", { t: fmtTime(state.dates.time) }));
    if (state.dates.place) parts.push(state.dates.place);
    $("hcSub").textContent = parts.join(". ");
  }
  renderNext();
}

export function initDates() {
  ["fNotice", "fDays", "fServed", "fHearing", "fTime", "fPlace"].forEach((id) => {
    $(id).addEventListener("input", () => {
      const prevHearing = state.dates.hearing;
      Object.assign(state.dates, { notice: $("fNotice").value, days: $("fDays").value, served: $("fServed").value, hearing: $("fHearing").value, time: $("fTime").value, place: $("fPlace").value });
      if (state.dates.hearing !== prevHearing) state.dates.fromPaper = false;
      renderDates();
    });
  });

  initReminderPreview();
  initDateFiles();
}
