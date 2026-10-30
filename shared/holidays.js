// Court holidays, for counting business days. Pure functions, no DOM.
//
// Sources (read 2026-10-30):
//  - Indiana Trial Rule 6(A): the last day of a period is skipped if it is a Saturday, Sunday or "legal holiday as
//    defined by state statute"; for periods under 7 days, intermediate weekends and legal holidays are not counted.
//    https://rules.incourts.gov/Content/trial/rule6/current.htm
//  - Indiana Trial Rule 88 gives "three (3) business days" to fix a rejected e-filing and does not define them.
//  - IC 1-1-9-1: the legal holidays and their dates, including the weekend rule: a holiday on a Sunday is observed
//    the following Monday, one on a Saturday the preceding Friday.
//  - Indiana Courts, state holidays and the dates the Governor declared them observed (2026 and 2027 at the time of writing):
//    https://secure.in.gov/courts/holidays  ("County court and clerk's offices may observe different hours and holidays
//    than state offices.")
//
// The statute and the court's list agree on twelve holidays, which are counted here. They disagree on two:
//  - Lincoln's Birthday: statute Feb 12; the court's list has the Friday after Thanksgiving.
//  - Washington's Birthday: statute the third Monday in February; the court's list has Dec 24 (2026), Dec 23 (2027).
// Neither date is counted. Counting a day that is not really a holiday would make a deadline later than it is; not
// counting one that is only makes it earlier. Flip UNCOUNTED if the court says which dates are right.

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const copy = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const plus = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// Easter Sunday (the standard Gregorian computation), for Good Friday.
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}
// The n-th given weekday (0 = Sunday) of a month (0 = January); the last one of a month.
const nth = (y, m, wd, n) => new Date(y, m, 1 + ((wd - new Date(y, m, 1).getDay() + 7) % 7) + 7 * (n - 1));
const last = (y, m, wd) => { const e = new Date(y, m + 1, 0); return new Date(y, m, e.getDate() - ((e.getDay() - wd + 7) % 7)); };
// IC 1-1-9-1(b): Sunday -> the following Monday, Saturday -> the preceding Friday.
const observed = (d) => (d.getDay() === 0 ? plus(d, 1) : d.getDay() === 6 ? plus(d, -1) : d);

// `id` is the key of the page text hol_<id>. `counted: false` means the sources disagree (see above).
const RULES = [
  { id: "newyear", date: (y) => new Date(y, 0, 1) },
  { id: "mlk", date: (y) => nth(y, 0, 1, 3) },
  { id: "lincoln", counted: false, date: (y) => new Date(y, 1, 12) },
  { id: "washington", counted: false, date: (y) => nth(y, 1, 1, 3) },
  { id: "goodfriday", date: (y) => plus(easter(y), -2) },
  { id: "primary", date: (y) => plus(nth(y, 4, 1, 1), 1) }, // the Tuesday after the first Monday in May
  { id: "memorial", date: (y) => last(y, 4, 1) },
  { id: "independence", date: (y) => new Date(y, 6, 4) },
  { id: "labor", date: (y) => nth(y, 8, 1, 1) },
  { id: "columbus", date: (y) => nth(y, 9, 1, 2) },
  { id: "general", date: (y) => plus(nth(y, 10, 1, 1), 1) }, // the Tuesday after the first Monday in November
  { id: "veterans", date: (y) => new Date(y, 10, 11) },
  { id: "thanksgiving", date: (y) => nth(y, 10, 4, 4) },
  { id: "christmas", date: (y) => new Date(y, 11, 25) }
];

export const COUNTED_IDS = RULES.filter((r) => r.counted !== false).map((r) => r.id);
export const UNCOUNTED_IDS = RULES.filter((r) => r.counted === false).map((r) => r.id);

// Every holiday for a year, after the weekend rule. Pass { all: true } to include the two that are not counted.
export function holidaysForYear(year, { all = false } = {}) {
  return RULES.filter((r) => all || r.counted !== false).map((r) => ({ id: r.id, date: observed(r.date(year)) }));
}

const tables = new Map();
function tableFor(year) {
  if (!tables.has(year)) {
    const m = new Map();
    // a New Year's Day on a Saturday is observed on Dec 31 of the year before, so next year's list matters too
    for (const y of [year, year + 1]) for (const h of holidaysForYear(y)) m.set(iso(h.date), h.id);
    tables.set(year, m);
  }
  return tables.get(year);
}

export const holidayOn = (d) => tableFor(d.getFullYear()).get(iso(d)) || null;
export const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;
// A day the clerk's office is normally open.
export const isCourtDay = (d) => !isWeekend(d) && !holidayOn(d);

export function nextCourtDay(d) { let x = copy(d); while (!isCourtDay(x)) x = plus(x, 1); return x; }
export function previousCourtDay(d) { let x = copy(d); while (!isCourtDay(x)) x = plus(x, -1); return x; }

// n court days after d (d itself is not counted), skipping weekends and holidays.
export function addCourtDays(d, n) {
  let x = copy(d), k = 0;
  while (k < n) { x = plus(x, 1); if (isCourtDay(x)) k++; }
  return x;
}

// The holidays that fall on weekdays from `from` to `to`, both included.
export function holidaysBetween(from, to) {
  const out = [];
  for (let x = copy(from); x <= to; x = plus(x, 1)) { const id = holidayOn(x); if (id && !isWeekend(x)) out.push({ id, date: x }); }
  return out;
}
