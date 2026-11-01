// "My dates": the timeline, Google Calendar links, the reminder preview and the saved text file.
import { $, el } from "/web/shared/lib/dom.js";
import { t, locale } from "/web/shared/lib/page-text.js";
import { state } from "/web/shared/state.js";
import { fmtDate, fmtShort, fmtTime } from "/web/shared/lib/date-format.js";
import { toast } from "/web/shared/ui/toast.js";
import { renderNext } from "/web/shared/layout/next-date.js";
import { REMS, eventStart, remindersFor } from "/shared/dates/reminders.js";
import { computeDates } from "/shared/dates/case-dates.js";
import { dayDiff, fromISO, ymd, hm, addDays, toISO } from "/shared/dates/date-math.js";
import { buildIcs } from "/shared/dates/ics.js";

function gcal(title, start, end, allDay, details, place) {
  const dates = allDay ? ymd(start) + "/" + ymd(addDays(start, 1)) : ymd(start) + "T" + hm(start) + "/" + ymd(end) + "T" + hm(end);
  let url = "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(title) + "&dates=" + dates + "&details=" + encodeURIComponent(details);
  if (place) url += "&location=" + encodeURIComponent(place);
  if (!allDay) url += "&ctz=America/Indiana/Indianapolis";
  return url;
}

// Each date from computeDates() gets its text from the d_<kind>_* strings.
const withText = (it) => Object.assign({}, it, { title: t("d_" + it.kind + "_title"), note: t("d_" + it.kind + "_note") });
const items = () => computeDates(state.dates).map(withText);
const reminders = (it) => remindersFor(it, state.rems).map((r) => Object.assign(r, { label: t(r.key) }));
const describe = (it) => it.title + (it.time ? " " + t("at_time", { t: fmtTime(it.time) }) : "");

function download(data, filename, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = el("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// The reminder choices appear on My dates and, inside the four-step path, on step 3, so nobody has to leave the path to use them.
export function renderRemChips() {
  document.querySelectorAll(".rem-chips").forEach((box) => {
    box.textContent = "";
    REMS.forEach((r) => {
      const b = el("button", "chip", t(r.key));
      b.type = "button";
      b.setAttribute("aria-pressed", String(!!state.rems[r.k]));
      b.addEventListener("click", () => { state.rems[r.k] = !state.rems[r.k]; renderRemChips(); renderDates(); });
      box.appendChild(b);
    });
  });
}

// One date on the timeline, with its calendar links. `upcomingOnly` leaves out dates that have passed (used inside the path).
function renderTimeline(list, all, { upcomingOnly = false } = {}) {
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
