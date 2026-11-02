// The reminder preview on My dates: when each reminder would go off, and what it would say.
import { $, el } from "/app/shared/lib/dom.js";
import { t, locale } from "/app/shared/lib/page-text.js";
import { fmtDate } from "/app/shared/lib/date-format.js";
import { dayDiff } from "/shared/dates/date-math.js";
import { items, reminders, describe } from "/app/dates/lib/date-items.js";

export function initReminderPreview() {
  // Preview only: nothing is sent or saved.
  $("smsBtn").addEventListener("click", () => {
    const ul = $("smsList");
    ul.textContent = "";
    const upcoming = items().filter((it) => dayDiff(it.date) >= 0);
    if (!upcoming.length) { ul.appendChild(el("li", null, t("sms_none"))); return; }
    const msgs = [];
    upcoming.forEach((it) => reminders(it).forEach((r) => msgs.push({ at: r.at, label: r.label, it })));
    msgs.sort((a, b) => a.at - b.at);
    if (!msgs.length) { ul.appendChild(el("li", null, t("sms_none"))); return; }
    msgs.forEach((m) => {
      const li = el("li");
      let when;
      try { when = new Intl.DateTimeFormat(locale(), { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(m.at); } catch (e) { when = m.at.toString(); }
      li.append(el("span", "when", when + " · " + m.label), el("span", null, t("sms_msg", { x: describe(m.it), d: fmtDate(m.it.date) + (m.it.place ? ", " + m.it.place : "") })));
      ul.appendChild(li);
    });
  });
}
