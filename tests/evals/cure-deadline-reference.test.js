// EVAL: is the last day to fix a returned filing right?
// A wrong date is the one mistake in this message that could cost someone their filing. This eval works the date out a second,
// plain way (step one day at a time, skipping weekends and the days on the court's own published holiday list) for every day
// of 2026 and 2027, and requires the shipped code to agree on every one.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { cureDeadline } from "../../shared/dates/cure-deadline.js";
import { COUNTED_IDS } from "../../shared/dates/holidays.js";
import { toISO } from "../../shared/dates/date-math.js";

const published = JSON.parse(fs.readFileSync(new URL("../fixtures/court-holidays-published.json", import.meta.url), "utf8"));
// Only the twelve holidays the statute and the court's list agree on: the code deliberately does not count the other two (see holidays.js).
const HOLIDAYS = new Set(Object.values(published.years).flat().filter(([id]) => COUNTED_IDS.includes(id)).map(([, date]) => date));

function reference(returned) {
  const [y, m, d] = returned.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  for (let counted = 0; counted < 3;) {
    day.setUTCDate(day.getUTCDate() + 1);
    const iso = day.toISOString().slice(0, 10);
    if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6 && !HOLIDAYS.has(iso)) counted++;
  }
  return day.toISOString().slice(0, 10);
}

test("the last day matches a day-by-day count against the court's published holidays, for every day of 2026 and 2027", () => {
  let checked = 0;
  const wrong = [];
  for (let t = Date.UTC(2026, 0, 1); t <= Date.UTC(2027, 11, 20); t += 86400000) {
    const returned = new Date(t).toISOString().slice(0, 10);
    const got = toISO(cureDeadline(returned).date), want = reference(returned);
    checked++;
    if (got !== want) wrong.push(`${returned}: got ${got}, want ${want}`);
  }
  console.log(`eval cure deadline: ${checked - wrong.length}/${checked} days match the reference`);
  assert.deepEqual(wrong, []);
});

test("whatever day it was returned, the last day is a court day, between 3 and 7 days later", () => {
  for (let t = Date.UTC(2026, 0, 1); t <= Date.UTC(2027, 11, 20); t += 86400000) {
    const returned = new Date(t).toISOString().slice(0, 10);
    const end = cureDeadline(returned).date;
    const days = Math.round((Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - t) / 86400000);
    assert.ok(days >= 3 && days <= 7, `${returned} -> ${toISO(end)} is ${days} days`);
    assert.ok(end.getDay() !== 0 && end.getDay() !== 6, `${returned} -> ${toISO(end)} is a weekend`);
    assert.ok(!HOLIDAYS.has(toISO(end)), `${returned} -> ${toISO(end)} is a court holiday`);
  }
});

test("the known hard cases: a long weekend, a holiday in the middle, and the year end", () => {
  const fix = (r) => toISO(cureDeadline(r).date);
  assert.equal(fix("2026-05-22"), "2026-05-28"); // Friday before Memorial Day: Tue, Wed, Thu
  assert.equal(fix("2026-11-10"), "2026-11-16"); // Veterans Day, Wed Nov 11, skipped: Thu, Fri, Mon
  assert.equal(fix("2026-12-29"), "2027-01-04"); // New Year's Day, Fri Jan 1, skipped: Wed, Thu, then Mon
  assert.equal(fix("2027-12-29"), "2028-01-04"); // New Year's Day 2028 is observed Fri Dec 31, 2027
});
