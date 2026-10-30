// Date math for the "My dates" tab and the clerk-notice fix-by date. Pure functions, no DOM.
import { addCourtDays, previousCourtDay, nextCourtDay, isCourtDay } from "./holidays.js";

export const pad = (n) => String(n).padStart(2, "0");
export function fromISO(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
export const toISO = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
export const ymd = (d) => "" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
export const hm = (d) => pad(d.getHours()) + pad(d.getMinutes()) + "00";
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
// Skips Saturdays, Sundays and court holidays (see holidays.js).
export const addBusinessDays = addCourtDays;

export const todayMid = (now = new Date()) => new Date(now.getFullYear(), now.getMonth(), now.getDate());
export const dayDiff = (d, now = new Date()) => Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - todayMid(now)) / 86400000);

// Reminder choices. `key` is the UI text key; allDay ones also apply to deadlines, the others only to a timed hearing.
export const REMS = [
  { k: "1w", key: "r_1w", ms: 7 * 864e5, allDay: true },
  { k: "3d", key: "r_3d", ms: 3 * 864e5, allDay: true },
  { k: "1d", key: "r_1d", ms: 864e5, allDay: true },
  { k: "2h", key: "r_2h", ms: 2 * 36e5, allDay: false },
  { k: "1h", key: "r_1h", ms: 36e5, allDay: false }
];

// Dates worked out from what the person entered. `kind` picks the text: d_<kind>_title and d_<kind>_note.
//  - cont: asked for in person, so it cannot be a day the clerk's office is closed: it moves back to the last court day.
//    `adjusted` says it did.
//  - jury: shown on the 10th day. If that is a weekend or court holiday, `next` is the court day Trial Rule 6(A) can move it to.
export function computeDates(d) {
  const items = [];
  const notice = fromISO(d.notice), served = fromISO(d.served), hearing = fromISO(d.hearing), cure = fromISO(d.cure);
  const days = Math.max(1, Math.min(90, parseInt(d.days, 10) || 15));
  if (notice) items.push({ kind: "notice", date: addDays(notice, days) });
  if (served) {
    const date = addDays(served, 10);
    items.push(isCourtDay(date) ? { kind: "jury", date } : { kind: "jury", date, next: nextCourtDay(date) });
  }
  if (hearing) {
    const eight = addDays(hearing, -8), date = previousCourtDay(eight);
    items.push(date.getTime() === eight.getTime() ? { kind: "cont", date } : { kind: "cont", date, adjusted: true });
    items.push({ kind: "hearing", date: hearing, time: d.time, place: d.place, hearing: true });
  }
  if (cure) items.push({ kind: "cure", date: cure });
  items.sort((a, b) => a.date - b.date);
  return items;
}

// Event start: the hearing time, or 9:00 a.m. for a deadline.
export function eventStart(it) {
  const [h, m] = (it.time || "09:00").split(":").map(Number);
  return new Date(it.date.getFullYear(), it.date.getMonth(), it.date.getDate(), h, m);
}

// Reminder times still in the future for one date. `rems` is the set of chosen reminder keys.
export function remindersFor(it, rems, now = new Date()) {
  const start = eventStart(it), out = [];
  REMS.forEach((r) => {
    if (!rems[r.k]) return;
    if (!it.hearing && !r.allDay) return; // hour reminders only make sense for a timed hearing
    const at = new Date(start.getTime() - r.ms);
    if (at <= now) return;
    out.push({ k: r.k, key: r.key, at });
  });
  return out;
}
