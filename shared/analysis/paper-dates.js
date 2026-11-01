// ---------- Dates ----------
import { pad, toISO } from "../dates/date-math.js";

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
export function findDates(text) {
  const found = new Map();
  const reWord = /\b(?:(?:mon|tues|wednes|thurs|fri|satur|sun)day,?\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})/gi;
  const reNum = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
  const push = (d, idx, len) => {
    if (isNaN(d)) return;
    const key = toISO(d);
    if (found.has(key)) return;
    const cs = Math.max(0, idx - 70);
    const ctx = text.slice(cs, idx + len + 50).replace(/\s+/g, " ").trim();
    const after = text.slice(idx + len, idx + len + 100);
    const tm = /(\d{1,2}):(\d{2})\s*([ap])\.?\s*m\.?/i.exec(after.slice(0, 40));
    let time = "";
    if (tm) { let h = parseInt(tm[1], 10) % 12; if (tm[3].toLowerCase() === "p") h += 12; time = pad(h) + ":" + tm[2]; }
    const room = /(Room\s+[\w-]+(?:,\s*[^.\n]{0,60})?)/i.exec(after);
    const hearingLike = /appear|hearing|conference|trial|court date/i.test(text.slice(Math.max(0, idx - 120), idx));
    found.set(key, { date: d, ctx: (cs > 0 ? "…" : "") + ctx + "…", time, place: room ? room[1].replace(/\s+/g, " ").trim() : "", hearingLike });
  };
  let m;
  while ((m = reWord.exec(text))) push(new Date(+m[3], MONTHS.indexOf(m[1].toLowerCase()), +m[2]), m.index, m[0].length);
  while ((m = reNum.exec(text))) push(new Date(+m[3], +m[1] - 1, +m[2]), m.index, m[0].length);
  return Array.from(found.values()).sort((a, b) => a.date - b.date);
}
