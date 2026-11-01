import { fromISO, addDays } from "./date-math.js";
import { isCourtDay, nextCourtDay, previousCourtDay } from "./holidays.js";

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
