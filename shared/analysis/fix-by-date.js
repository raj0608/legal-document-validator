// ---------- Clerk notice: fix-by date ----------
import { addDays, addBusinessDays } from "../dates/date-math.js";
import { holidaysBetween } from "../dates/holidays.js";
import { findDates } from "./paper-dates.js";

const WORDNUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fourteen: 14, fifteen: 15, thirty: 30, seventy: 70, "seventy-two": 72 };
export function findDeadline(text) {
  const re = /(?:within|in)\s+(?:([a-z-]+)\s+)?\(?(\d{1,3})?\)?\s*(business|court|calendar)?\s*(days?|hours?)/i;
  const m = re.exec(text);
  let n = null, unit = null, kind = "", quote = "";
  if (m) {
    n = m[2] ? +m[2] : (m[1] && WORDNUM[m[1].toLowerCase()]) || null;
    unit = m[4].toLowerCase().startsWith("hour") ? "hours" : "days";
    kind = (m[3] || "").toLowerCase();
    const s = text.lastIndexOf(".", m.index) + 1;
    const e = text.indexOf(".", m.index + m[0].length);
    quote = text.slice(s, e === -1 ? undefined : e + 1).replace(/\s+/g, " ").trim();
  } else {
    const h = /(\d{1,3})\s*-?\s*hours?/i.exec(text);
    if (h) { n = +h[1]; unit = "hours"; const s = text.lastIndexOf(".", h.index) + 1; const e = text.indexOf(".", h.index); quote = text.slice(s, e === -1 ? undefined : e + 1).replace(/\s+/g, " ").trim(); }
  }
  if (!n) return null;
  const dateLabel = /\bdate\s*:\s*/i.exec(text);
  let base = null;
  const dates = findDates(text);
  if (dateLabel) { const after = findDates(text.slice(dateLabel.index, dateLabel.index + 60)); if (after.length) base = after[0].date; }
  if (!base && dates.length) base = dates[0].date;
  if (!base) return { n, unit, kind, quote, date: null };
  let date;
  if (unit === "hours") date = addDays(base, Math.ceil(n / 24));
  else if (kind === "business" || kind === "court") date = addBusinessDays(base, n);
  else date = addDays(base, n);
  // `skipped`: the court holidays that were left out of a business-day count
  const skipped = (kind === "business" || kind === "court") && unit !== "hours" ? holidaysBetween(addDays(base, 1), date) : [];
  return { n, unit, kind, quote, date, base, skipped };
}
