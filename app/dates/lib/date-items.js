// The person's dates with their words, and the reminders for each one.
import { t } from "/app/shared/lib/page-text.js";
import { state } from "/app/shared/state.js";
import { fmtTime } from "/app/shared/lib/date-format.js";
import { computeDates } from "/shared/dates/case-dates.js";
import { remindersFor } from "/shared/dates/reminders.js";

// Each date from computeDates() gets its text from the d_<kind>_* strings.
const withText = (it) => Object.assign({}, it, { title: t("d_" + it.kind + "_title"), note: t("d_" + it.kind + "_note") });
export const items = () => computeDates(state.dates).map(withText);
export const reminders = (it) => remindersFor(it, state.rems).map((r) => Object.assign(r, { label: t(r.key) }));
export const describe = (it) => it.title + (it.time ? " " + t("at_time", { t: fmtTime(it.time) }) : "");
