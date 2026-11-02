// ---------- Dates and times, in the reader's language ----------
import { locale } from "/app/shared/lib/page-text.js";

export function fmtDate(d) { try { return new Intl.DateTimeFormat(locale(), { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(d); } catch (e) { return d.toDateString(); } }
export function fmtShort(d) { try { return new Intl.DateTimeFormat(locale(), { weekday: "short", month: "short", day: "numeric" }).format(d); } catch (e) { return d.toDateString(); } }
export function fmtTime(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  try { return new Intl.DateTimeFormat(locale(), { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, h, m)); } catch (e) { return hhmm; }
}
