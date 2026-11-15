// ---------- The 90-day pause: its dates ----------
// Indiana Supreme Court order 22S-MS-308 (2022): when both sides agree to take part in pre-eviction diversion, the
// eviction is stayed for ninety days, and the case management order sets status conferences at thirty and sixty days.
// A conference cannot fall on a weekend or a court holiday, so it moves to the next court day. The pause itself just
// runs ninety days. The court can also take a written status report in place of a conference.
import { fromISO, toISO, addDays, dayDiff } from "../dates/date-math.js";
import { nextCourtDay } from "../dates/holidays.js";

export const PAUSE_DAYS = 90;
export const CONFERENCES = ["day30", "day60"];

export function scheduleFor(startISO) {
  const start = fromISO(startISO);
  if (!start) return null;
  return {
    day30: toISO(nextCourtDay(addDays(start, 30))),
    day60: toISO(nextCourtDay(addDays(start, 60))),
    ends: toISO(addDays(start, PAUSE_DAYS))
  };
}

// Whole days from today to a date: 0 is today, negative is past.
export const daysFrom = (iso, todayISO) => dayDiff(fromISO(iso), fromISO(todayISO));

// The three dates of a paused case and where each stands: done (a conference held, or a report filed instead), or how far away.
export function milestones(p, todayISO) {
  const s = scheduleFor(p.start);
  return [
    { key: "day30", date: s.day30, done: p.day30 || null, inDays: daysFrom(s.day30, todayISO) },
    { key: "day60", date: s.day60, done: p.day60 || null, inDays: daysFrom(s.day60, todayISO) },
    { key: "ends", date: s.ends, done: null, inDays: daysFrom(s.ends, todayISO) }
  ];
}

// The next date that needs the clerk: the first conference not yet done, or else the end of the pause.
export function nextMilestone(p, todayISO) {
  return milestones(p, todayISO).find((m) => !m.done) || null;
}

// What needs the clerk in the next seven days (or is already late): conferences not yet done, and pauses ending.
export function dueThisWeek(pauses, todayISO) {
  const paused = pauses.filter((p) => p.state === "paused");
  let conferences = 0, ending = 0;
  for (const p of paused) {
    for (const m of milestones(p, todayISO)) {
      if (m.done || m.inDays > 7) continue;
      if (m.key === "ends") ending++; else conferences++;
    }
  }
  return { conferences, ending };
}

// Paused cases, the one that needs the clerk soonest first.
export function byUrgency(pauses, todayISO) {
  const soon = (p) => { const m = nextMilestone(p, todayISO); return m ? m.inDays : Infinity; };
  return pauses.slice().sort((a, b) => soon(a) - soon(b));
}
