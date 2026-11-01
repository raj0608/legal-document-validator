// Saving the dates as files made in the browser: a calendar file (.ics) and a text file.
import { $, el } from "/web/shared/lib/dom.js";
import { t } from "/web/shared/lib/page-text.js";
import { fmtDate, fmtTime } from "/web/shared/lib/date-format.js";
import { toast } from "/web/shared/ui/toast.js";
import { eventStart } from "/shared/dates/reminders.js";
import { dayDiff, toISO } from "/shared/dates/date-math.js";
import { buildIcs } from "/shared/dates/ics.js";
import { items, reminders, describe } from "/web/screens/dates/lib/date-items.js";

function download(data, filename, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = el("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function initDateFiles() {
  // One calendar file with every upcoming date and the chosen reminders as alarms. Made in the browser; nothing is sent.
  const saveIcs = () => {
    const events = items().filter((it) => dayDiff(it.date) >= 0).map((it) => ({
      uid: it.kind + "-" + toISO(it.date) + "@ready-for-court",
      summary: describe(it),
      description: it.note + "\n\n" + t("cal_details"),
      location: it.place,
      start: it.time ? eventStart(it) : new Date(it.date.getFullYear(), it.date.getMonth(), it.date.getDate()),
      allDay: !it.time,
      alarms: reminders(it).map((r) => ({ at: r.at, text: t("rem_title", { x: describe(it) }) + " · " + r.label }))
    }));
    download(buildIcs(events, { name: t("dates_h") }), "my-court-dates.ics", "text/calendar;charset=utf-8");
    toast(t("saved"));
  };
  $("icsBtn").addEventListener("click", saveIcs);
  $("flowIcsBtn").addEventListener("click", saveIcs);

  // The file is made in the browser and handed to the browser's own download. It never touches the server.
  $("saveDates").addEventListener("click", () => {
    const lines = [t("dates_file_head"), ""];
    items().forEach((it) => {
      lines.push(fmtDate(it.date) + (it.time ? " " + t("at_time", { t: fmtTime(it.time) }) : "") + ": " + it.title);
      if (it.place) lines.push("  " + it.place);
      lines.push("  " + it.note, "");
    });
    download(lines.join("\n"), "my-court-dates.txt", "text/plain;charset=utf-8");
    toast(t("saved"));
  });
}
