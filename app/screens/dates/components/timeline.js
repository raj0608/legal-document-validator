// The list of dates on My dates and on step 3 of My papers, with links that add each date to Google Calendar.
import { el } from "/app/shared/lib/dom.js";
import { t } from "/app/shared/lib/page-text.js";
import { fmtDate, fmtShort, fmtTime } from "/app/shared/lib/date-format.js";
import { dayDiff } from "/shared/dates/date-math.js";
import { eventStart } from "/shared/dates/reminders.js";
import { gcal } from "/app/screens/dates/lib/google-calendar.js";
import { reminders, describe } from "/app/screens/dates/lib/date-items.js";

// One date on the timeline, with its calendar links. `upcomingOnly` leaves out dates that have passed (used inside the path).
export function renderTimeline(list, all, { upcomingOnly = false } = {}) {
  list.textContent = "";
  all.forEach((it) => {
    const diff = dayDiff(it.date);
    if (upcomingOnly && diff < 0) return;
    const li = el("li");
    if (diff < 0) li.classList.add("past");
    const dateEl = el("span", "tl-date");
    dateEl.appendChild(el("mark", null, fmtDate(it.date) + (it.time ? " " + t("at_time", { t: fmtTime(it.time) }) : "")));
    li.append(dateEl, el("span", "tl-title", it.title), el("span", "tl-note", (diff < 0 ? t("was_past") + " " : "") + it.note));
    if (it.place) li.appendChild(el("span", "tl-note", it.place));
    if (it.adjusted) li.appendChild(el("span", "tl-note", t("d_adjusted_back")));
    if (it.next) li.appendChild(el("span", "tl-note", t("d_moves_forward", { d: fmtDate(it.next) })));
    if (diff >= 0) {
      const links = el("div", "tl-links");
      const start = eventStart(it);
      const main = el("a", null, t("add_cal"));
      main.href = gcal(it.title, start, new Date(start.getTime() + 36e5), !it.time, it.note + "\n\n" + t("cal_details"), it.place);
      main.target = "_blank"; main.rel = "noopener";
      links.appendChild(main);
      reminders(it).forEach((r) => {
        const a = el("a", null, t("add_rem", { x: r.label }));
        a.href = gcal(t("rem_title", { x: describe(it) }) + " · " + fmtShort(it.date), r.at, new Date(r.at.getTime() + 15 * 60000), false, it.note + "\n\n" + t("cal_details"), it.place);
        a.target = "_blank"; a.rel = "noopener";
        links.appendChild(a);
      });
      li.appendChild(links);
    }
    list.appendChild(li);
  });
}
