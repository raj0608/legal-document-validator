// The last day to fix a returned filing: three business days from the day it was returned (Trial Rule 88).
import test from "node:test";
import assert from "node:assert/strict";
import { cureDeadline, CURE_BUSINESS_DAYS } from "../../shared/dates/cure-deadline.js";
import { toISO } from "../../shared/dates/date-math.js";

const fixBy = (iso) => toISO(cureDeadline(iso).date);

test("three business days, counted from the day after it was returned", () => {
  assert.equal(CURE_BUSINESS_DAYS, 3);
  assert.equal(fixBy("2026-11-04"), "2026-11-09"); // Wednesday: Thu, Fri, then the weekend is skipped, Monday
  assert.equal(fixBy("2026-11-16"), "2026-11-19"); // Monday: Tue, Wed, Thu
});

test("weekends do not count", () => {
  assert.equal(fixBy("2026-11-13"), "2026-11-18"); // a Friday: Mon, Tue, Wed
  assert.equal(fixBy("2026-11-14"), "2026-11-18"); // returned on a Saturday
});

test("court holidays do not count, and the holidays left out are listed", () => {
  const d = cureDeadline("2026-11-09"); // Veterans Day, Wednesday Nov 11, is skipped
  assert.equal(toISO(d.date), "2026-11-13");
  assert.deepEqual(d.skipped.map((h) => h.id), ["veterans"]);
  const t = cureDeadline("2026-11-24"); // Thanksgiving, Thursday Nov 26, is skipped
  assert.deepEqual(t.skipped.map((h) => h.id), ["thanksgiving"]);
});

test("a day that is not a real calendar day gives nothing", () => {
  for (const bad of ["", "2026-02-30", "2026-13-01", "11/09/2026", null, undefined, "2026-11-9"]) assert.equal(cureDeadline(bad), null, String(bad));
});
