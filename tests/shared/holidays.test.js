import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { holidaysForYear, holidayOn, isCourtDay, addCourtDays, nextCourtDay, previousCourtDay, holidaysBetween, COUNTED_IDS, UNCOUNTED_IDS } from "../../shared/dates/holidays.js";
import { toISO, fromISO } from "../../shared/dates/date-math.js";

const published = JSON.parse(fs.readFileSync(new URL("../fixtures/court-holidays-published.json", import.meta.url), "utf8"));
const d = fromISO;
const iso = (x) => toISO(x);

test("the holidays the statute and the court's published list agree on match the published list exactly", () => {
  for (const [year, rows] of Object.entries(published.years)) {
    const counted = rows.filter(([id]) => COUNTED_IDS.includes(id));
    const wanted = counted.map(([id, date]) => id + " " + date).sort();
    // Dec 31 2027 is New Year's Day 2028 (it falls on a Saturday), so it is listed under 2027 in the court's list
    const got = [...holidaysForYear(+year), ...holidaysForYear(+year + 1)]
      .filter((h) => h.date.getFullYear() === +year)
      .map((h) => h.id + " " + iso(h.date)).sort();
    assert.deepEqual(got, wanted, year);
  }
});

test("the two holidays the sources disagree on are not counted, on either set of dates", () => {
  assert.deepEqual(UNCOUNTED_IDS.sort(), ["lincoln", "washington"]);
  for (const [year, rows] of Object.entries(published.years)) {
    for (const [id, date] of rows.filter(([id]) => UNCOUNTED_IDS.includes(id))) assert.ok(isCourtDay(d(date)) || d(date).getDay() % 6 === 0, id + " " + date + " (court list)");
  }
  for (const date of ["2026-02-12", "2026-02-16", "2027-02-12", "2027-02-15"]) assert.equal(holidayOn(d(date)), null, "statute dates " + date);
  assert.equal(holidaysForYear(2026, { all: true }).length, 14);
});

test("Good Friday follows Easter in any year", () => {
  const gf = (y) => iso(holidaysForYear(y).find((h) => h.id === "goodfriday").date);
  assert.equal(gf(2025), "2025-04-18");
  assert.equal(gf(2026), "2026-04-03");
  assert.equal(gf(2028), "2028-04-14");
  assert.equal(gf(2030), "2030-04-19");
});

test("a holiday on a weekend moves to the Friday before or the Monday after, even across a year end", () => {
  assert.equal(holidayOn(d("2026-07-03")), "independence"); // July 4, 2026 is a Saturday
  assert.equal(holidayOn(d("2026-07-04")), null);
  assert.equal(holidayOn(d("2027-07-05")), "independence"); // July 4, 2027 is a Sunday
  assert.equal(holidayOn(d("2027-12-24")), "christmas");
  assert.equal(holidayOn(d("2027-12-31")), "newyear"); // January 1, 2028 is a Saturday
  assert.equal(holidayOn(d("2028-01-01")), null);
  assert.equal(holidayOn(d("2023-01-02")), "newyear"); // January 1, 2023 was a Sunday
});

test("court days skip weekends and counted holidays only", () => {
  assert.ok(!isCourtDay(d("2026-11-26"))); // Thanksgiving
  assert.ok(!isCourtDay(d("2026-11-14"))); // Saturday
  assert.ok(isCourtDay(d("2026-11-27"))); // the day after: not counted as a holiday (sources disagree)
  assert.equal(iso(nextCourtDay(d("2026-11-26"))), "2026-11-27");
  assert.equal(iso(nextCourtDay(d("2026-11-27"))), "2026-11-27");
  assert.equal(iso(previousCourtDay(d("2026-11-15"))), "2026-11-13"); // Sunday -> Friday
  assert.equal(iso(previousCourtDay(d("2026-11-11"))), "2026-11-10"); // Veterans Day
});

test("counting court days skips holidays", () => {
  assert.equal(iso(addCourtDays(d("2026-11-09"), 3)), "2026-11-13"); // Veterans Day, Wed Nov 11, is skipped
  assert.equal(iso(addCourtDays(d("2026-11-25"), 2)), "2026-11-30"); // Thanksgiving skipped, then the weekend
  assert.equal(iso(addCourtDays(d("2026-12-23"), 1)), "2026-12-24");
  assert.equal(iso(addCourtDays(d("2026-12-24"), 1)), "2026-12-28"); // Christmas, then the weekend
  assert.equal(iso(addCourtDays(d("2026-11-09"), 0)), "2026-11-09");
});

test("the holidays inside a range are listed", () => {
  const h = holidaysBetween(d("2026-11-10"), d("2026-11-13"));
  assert.deepEqual(h.map((x) => [x.id, iso(x.date)]), [["veterans", "2026-11-11"]]);
  assert.deepEqual(holidaysBetween(d("2026-11-12"), d("2026-11-13")), []);
});

test("every year has twelve counted holidays, all on weekdays", () => {
  for (let y = 2024; y <= 2040; y++) {
    const hs = holidaysForYear(y);
    assert.equal(hs.length, 12, String(y));
    for (const h of hs) assert.ok(h.date.getDay() % 6 !== 0, y + " " + h.id + " " + iso(h.date));
    assert.equal(new Set(hs.map((h) => iso(h.date))).size, 12, y + " no two on one day");
  }
});
