import test from "node:test";
import assert from "node:assert/strict";
import { markDates, datesIn, unsupportedDates, allowedDates } from "../shared/answer-dates.js";
import { SAMPLE, CLERK_SAMPLE } from "../shared/sample-papers.js";

test("a date the AI forgot to highlight is highlighted, with the right weekday added", () => {
  assert.equal(markDates("The hearing is on November 24, 2026 at 9:00 a.m."), "The hearing is on ==Tuesday, November 24, 2026== at 9:00 a.m.");
  assert.equal(markDates("Date issued: November 2, 2026."), "Date issued: ==Monday, November 2, 2026==.");
  assert.equal(markDates("On Nov 24"), "On Nov 24", "short or partial dates are left alone");
});

test("a weekday the AI already wrote is kept, and the date is highlighted", () => {
  assert.equal(markDates("It is “Tuesday, November 24, 2026”."), "It is “==Tuesday, November 24, 2026==”.");
  assert.equal(markDates("on tuesday november 24 2026"), "on tuesday november 24 2026", "case and punctuation of the format are respected: only the written format is matched");
});

test("a date that is already highlighted is not changed or highlighted twice", () => {
  const s = "Go on ==Tuesday, November 24, 2026== and ==Monday, November 2, 2026==.";
  assert.equal(markDates(s), s);
  assert.equal(markDates(markDates("May 5, 2027")), "==Wednesday, May 5, 2027==");
  assert.equal(markDates("on ==November 9, 2026== only"), "on ==Monday, November 9, 2026== only", "a highlighted date without a weekday gets one");
  assert.equal(markDates("==February 30, 2026=="), "==February 30, 2026==", "an impossible date is left as written");
});

test("several dates, ordinals and non-dates", () => {
  assert.equal(markDates("November 12, 2026 or December 1st, 2026"), "==Thursday, November 12, 2026== or ==Tuesday, December 1st, 2026==");
  assert.equal(markDates("February 30, 2026 is not a day"), "February 30, 2026 is not a day");
  assert.equal(markDates("In 2026 the rent was $3,150.00 for August, September."), "In 2026 the rent was $3,150.00 for August, September.");
  assert.equal(markDates(""), "");
});

test("the weekday comes from the calendar, including leap years and year ends", () => {
  assert.equal(markDates("February 29, 2028"), "==Tuesday, February 29, 2028==");
  assert.equal(markDates("December 31, 2027"), "==Friday, December 31, 2027==");
  assert.equal(markDates("January 1, 2027"), "==Friday, January 1, 2027==");
});

test("dates in an answer are listed, and invalid ones are skipped", () => {
  assert.deepEqual(datesIn("On ==Tuesday, November 24, 2026== and December 1, 2026; not February 30, 2026.").map((d) => d.iso), ["2026-11-24", "2026-12-01"]);
});

// Found in live testing: for a notice that says "within three business days", the AI wrote "You have Wednesday, November 11,
// 2026 through Friday, November 13, 2026". Neither date is in the notice (and November 11 is a court holiday).
test("a date the AI worked out is caught; the paper's own dates and our sources' dates are not", () => {
  const allowed = allowedDates(CLERK_SAMPLE); // the notice is dated November 9, 2026
  assert.deepEqual(unsupportedDates("You have Wednesday, November 11, 2026 through Friday, November 13, 2026 to fix it.", allowed), ["Wednesday, November 11, 2026", "Friday, November 13, 2026"]);
  assert.deepEqual(unsupportedDates("The notice is dated ==Monday, November 9, 2026==.", allowed), []);
  assert.deepEqual(unsupportedDates("November 9, 2026 and November 9, 2026 again", allowed), []);
  assert.deepEqual(unsupportedDates("Hearing ==Tuesday, November 24, 2026==", allowedDates(SAMPLE)), []);
  assert.deepEqual(unsupportedDates("Since July 1, 2025, some eviction cases are sealed automatically.", allowedDates("")), []);
  assert.deepEqual(unsupportedDates("Your hearing is November 24, 2026", allowedDates("")), ["November 24, 2026"], "with no paper, any date is the AI's own");
});
