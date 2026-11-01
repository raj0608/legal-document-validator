// Date math for the "My dates" tab and the clerk-notice fix-by date. Pure functions, no DOM.
import { addCourtDays } from "./holidays.js";

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
