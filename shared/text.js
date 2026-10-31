// Small helpers for showing the AI's words. Pure functions, no DOM.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DATE_RE = new RegExp("(?:(" + DAYS.join("|") + "),?\\s+)?(" + MONTHS.join("|") + ")\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})", "g");

// The rules ask the AI to write every date like “==Tuesday, November 24, 2026==”, so the page can highlight it. A small model
// often forgets the highlight or the weekday. This puts both back: it wraps each English-format date in == and, when the
// weekday is missing, adds the right one from the calendar (a weekday the AI works out for itself can be wrong).
// A weekday that is already there is left alone. Dates that are already highlighted are not highlighted twice.
export function markDates(text) {
  return String(text).split(/(==[^=\n]+==)/).map((part, i) => {
    if (i % 2 === 1) { // already highlighted: leave it, except that a bare date gets its weekday
      const inner = part.slice(2, -2), m = new RegExp("^(" + MONTHS.join("|") + ")\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})$").exec(inner);
      if (!m) return part;
      const d = new Date(+m[3], MONTHS.indexOf(m[1]), +m[2]);
      return d.getMonth() === MONTHS.indexOf(m[1]) && d.getDate() === +m[2] ? "==" + DAYS[d.getDay()] + ", " + inner + "==" : part;
    }
    return part.replace(DATE_RE, (m, wd, month, day, year) => {
      const d = new Date(+year, MONTHS.indexOf(month), +day);
      if (d.getMonth() !== MONTHS.indexOf(month) || d.getDate() !== +day) return m; // not a real date, e.g. February 30
      return "==" + (wd ? m : DAYS[d.getDay()] + ", " + m) + "==";
    });
  }).join("");
}

const pad = (n) => String(n).padStart(2, "0");
// Every English-format date in a piece of text, as { iso, text }. Invalid dates (February 30) are skipped.
export function datesIn(text) {
  const out = [];
  for (const m of String(text).matchAll(DATE_RE)) {
    const [, wd, month, day, year] = m;
    const mi = MONTHS.indexOf(month), d = new Date(+year, mi, +day);
    if (d.getMonth() !== mi || d.getDate() !== +day) continue;
    out.push({ iso: year + "-" + pad(mi + 1) + "-" + pad(+day), text: (wd ? wd + ", " : "") + month + " " + day + ", " + year });
  }
  return out;
}

// Dates in an answer that are not among the allowed ones (the paper's own dates, plus dates in our sources).
// The AI is told never to work out a date, but a small model sometimes counts days anyway; this catches it.
export function unsupportedDates(answer, allowedIso) {
  const seen = new Set(), out = [];
  for (const d of datesIn(answer)) if (!allowedIso.has(d.iso) && !seen.has(d.iso)) { seen.add(d.iso); out.push(d.text); }
  return out;
}
