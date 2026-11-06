// The last day to fix a filing the clerk sent back. Trial Rule 88: three business days from when it was returned
// (weekends and court holidays do not count), and a filing fixed in time is treated as filed on the original date.
import { fromISO, toISO, addDays, addBusinessDays } from "./date-math.js";
import { holidaysBetween } from "./holidays.js";

export const CURE_BUSINESS_DAYS = 3;

// `returnedISO` is a calendar day like "2026-11-09". Returns { date, skipped } (court holidays left out of the count), or null for a bad day.
export function cureDeadline(returnedISO) {
  const base = fromISO(returnedISO);
  if (!base || toISO(base) !== returnedISO) return null; // fromISO rolls 2026-02-30 over to March 2; that is not a day
  const date = addBusinessDays(base, CURE_BUSINESS_DAYS);
  return { date, skipped: holidaysBetween(addDays(base, 1), date) };
}
