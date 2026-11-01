// Reminder choices. `key` is the UI text key; allDay ones also apply to deadlines, the others only to a timed hearing.
export const REMS = [
  { k: "1w", key: "r_1w", ms: 7 * 864e5, allDay: true },
  { k: "3d", key: "r_3d", ms: 3 * 864e5, allDay: true },
  { k: "1d", key: "r_1d", ms: 864e5, allDay: true },
  { k: "2h", key: "r_2h", ms: 2 * 36e5, allDay: false },
  { k: "1h", key: "r_1h", ms: 36e5, allDay: false }
];

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
