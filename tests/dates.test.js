import test from "node:test";
import assert from "node:assert/strict";
import { addBusinessDays, addDays, computeDates, remindersFor, dayDiff, toISO, fromISO } from "../shared/dates.js";

const d = (s) => fromISO(s);

test("business days skip weekends", () => {
  assert.equal(toISO(addBusinessDays(d("2026-11-06"), 1)), "2026-11-09"); // Friday -> Monday
  assert.equal(toISO(addBusinessDays(d("2026-11-16"), 3)), "2026-11-19"); // Monday + 3
  assert.equal(toISO(addBusinessDays(d("2026-11-12"), 3)), "2026-11-17"); // Thursday + 3 crosses a weekend
  assert.equal(toISO(addDays(d("2026-11-09"), 5)), "2026-11-14");
});

test("dates are worked out from what the person entered", () => {
  const items = computeDates({ notice: "2026-10-01", days: "15", served: "2026-11-02", hearing: "2026-11-24", time: "09:00", place: "Room 000", cure: "" });
  assert.deepEqual(items.map((i) => [i.kind, toISO(i.date)]), [
    ["notice", "2026-10-16"], ["jury", "2026-11-12"], ["cont", "2026-11-16"], ["hearing", "2026-11-24"]
  ]);
  assert.equal(items.at(-1).place, "Room 000");
  assert.deepEqual(computeDates({ notice: "", days: 15, served: "", hearing: "", time: "", place: "", cure: "" }), []);
});

test("the notice period is limited to 1 to 90 days and defaults to 15", () => {
  const f = (days) => toISO(computeDates({ notice: "2026-10-01", days }).at(0).date);
  assert.equal(f("abc"), "2026-10-16");
  assert.equal(f("500"), "2026-12-30");
  assert.equal(f("0"), "2026-10-16"); // 0 is not a number of days, so the default applies
});

test("reminders: only future ones, and hour reminders only for a timed hearing", () => {
  const now = new Date(2026, 10, 20, 12, 0); // Nov 20, 2026 noon
  const all = { "1w": true, "3d": true, "1d": true, "2h": true, "1h": true };
  const hearing = { kind: "hearing", date: d("2026-11-24"), time: "09:00", hearing: true };
  assert.deepEqual(remindersFor(hearing, all, now).map((r) => r.k), ["3d", "1d", "2h", "1h"]); // 1 week before has passed
  const deadline = { kind: "cure", date: d("2026-11-24") };
  assert.deepEqual(remindersFor(deadline, all, now).map((r) => r.k), ["3d", "1d"]);
  assert.deepEqual(remindersFor(hearing, {}, now), []);
});

test("day counts use calendar days, not elapsed hours", () => {
  const now = new Date(2026, 10, 20, 23, 30);
  assert.equal(dayDiff(d("2026-11-21"), now), 1);
  assert.equal(dayDiff(d("2026-11-20"), now), 0);
  assert.equal(dayDiff(d("2026-11-19"), now), -1);
});

test("the last day to ask in person moves back when it would be a day the clerk is closed", () => {
  const cont = (hearing) => computeDates({ hearing, days: 15 }).find((i) => i.kind === "cont");
  const ok = cont("2026-11-24"); // 8 days before is Monday, Nov 16
  assert.equal(toISO(ok.date), "2026-11-16"); assert.equal(ok.adjusted, undefined);
  const sunday = cont("2026-11-23"); // 8 days before is Sunday, Nov 15
  assert.equal(toISO(sunday.date), "2026-11-13"); assert.equal(sunday.adjusted, true);
  const holiday = cont("2026-11-19"); // 8 days before is Veterans Day, Wed Nov 11
  assert.equal(toISO(holiday.date), "2026-11-10"); assert.equal(holiday.adjusted, true);
});

test("the jury-trial day stays on the 10th day and says when Trial Rule 6(A) could move it", () => {
  const jury = (served) => computeDates({ served, days: 15 }).find((i) => i.kind === "jury");
  const plain = jury("2026-11-02"); // Nov 12, a Thursday
  assert.equal(toISO(plain.date), "2026-11-12"); assert.equal(plain.next, undefined);
  const thanksgiving = jury("2026-11-16"); // Nov 26, Thanksgiving
  assert.equal(toISO(thanksgiving.date), "2026-11-26"); assert.equal(toISO(thanksgiving.next), "2026-11-27");
  const weekend = jury("2026-11-05"); // Nov 15, a Sunday
  assert.equal(toISO(weekend.date), "2026-11-15"); assert.equal(toISO(weekend.next), "2026-11-16");
});

test("business days now skip court holidays", () => {
  assert.equal(toISO(addBusinessDays(d("2026-11-09"), 3)), "2026-11-13");
});
