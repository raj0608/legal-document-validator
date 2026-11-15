// 90-day pauses (Indiana Supreme Court order 22S-MS-308): their dates, what the clerk and the rental-aid agency can
// change, and the drafted docket entries and sealing order.
import test from "node:test";
import assert from "node:assert/strict";
import { scheduleFor, milestones, nextMilestone, dueThisWeek, byUrgency } from "../../shared/court/pause-schedule.js";
import { applyPauseAction, applyAidUpdate, pauseFromHearing, isConfidential, needsSealing, NOTE_MAX } from "../../shared/court/pause-case.js";
import { hearingEntry, pauseEntry, sealingOrder } from "../../shared/court/docket-drafts.js";

const pause = (over = {}) => ({
  id: "p1", cause: "99D00-2609-EV-000201", landlord: "Cedar Park Apartments LLC", tenant: "O. White", start: "2026-10-01",
  state: "paused", resolution: null, sealed: false, agency: "Sample Rental Help", closedOn: null, day30: null, day60: null, aid: null, ...over
});

test("a pause runs 90 days, with conferences at 30 and 60 days moved off weekends and court holidays", () => {
  // Oct 1, 2026 + 30 is Saturday Oct 31, so Monday Nov 2. + 60 is Monday Nov 30. + 90 is Dec 30.
  assert.deepEqual(scheduleFor("2026-10-01"), { day30: "2026-11-02", day60: "2026-11-30", ends: "2026-12-30" });
  // Oct 12 + 30 is Veterans Day, a court holiday, so Thursday Nov 12.
  assert.equal(scheduleFor("2026-10-12").day30, "2026-11-12");
  assert.equal(scheduleFor("not a date"), null);
});

test("each date says where it stands, the next one is the first not done, and the week counts late ones too", () => {
  const p = pause({ day30: { how: "report", on: "2026-11-02" } });
  const late = pause({ id: "p2", start: "2026-09-25" });
  assert.deepEqual(milestones(p, "2026-11-25").map((m) => [m.key, m.inDays, Boolean(m.done)]), [["day30", -23, true], ["day60", 5, false], ["ends", 35, false]]);
  assert.equal(nextMilestone(p, "2026-11-25").key, "day60");
  assert.deepEqual(dueThisWeek([p, late, pause({ id: "p3", state: "lifted" })], "2026-11-25"), { conferences: 3, ending: 0 });
  assert.deepEqual(byUrgency([p, late], "2026-11-25").map((x) => x.id), ["p2", "p1"]);
});

test("the clerk's steps: a conference or a report in its place, then dismissed, an agreement, or a lifted pause", () => {
  const p = applyPauseAction(pause(), { type: "conference", which: "day30", how: "held" }, "2026-11-02");
  assert.deepEqual(p.day30, { how: "held", on: "2026-11-02" });
  const dismissed = applyPauseAction(p, { type: "dismiss" }, "2026-12-01");
  assert.deepEqual([dismissed.state, dismissed.resolution, dismissed.closedOn], ["resolved", "dismissed", "2026-12-01"]);
  assert.ok(needsSealing(dismissed) && isConfidential(dismissed), "a dismissed case is flagged for sealing");
  const sealed = applyPauseAction(dismissed, { type: "sealed" }, "2026-12-02");
  assert.ok(sealed.sealed && !needsSealing(sealed));
  assert.throws(() => applyPauseAction(sealed, { type: "sealed" }, "2026-12-03"), /bad_action/);
  const agreed = applyPauseAction(p, { type: "agreement" }, "2026-12-01");
  assert.ok(isConfidential(agreed) && !needsSealing(agreed), "an agreement keeps the records confidential");
  const lifted = applyPauseAction(p, { type: "lift" }, "2026-11-10");
  assert.equal(isConfidential(lifted), false, "a lifted pause ends confidentiality, as in 2(d)(i) of the order");
  assert.throws(() => applyPauseAction(lifted, { type: "dismiss" }, "2026-11-11"), /bad_action/);
  for (const a of [{ type: "conference", which: "day90", how: "held" }, { type: "conference", which: "day30", how: "phone" }, { type: "erase" }, null]) {
    assert.throws(() => applyPauseAction(p, a, "2026-11-10"), /bad_action/, JSON.stringify(a));
  }
});

test("the agency's update: a known status, a whole-dollar amount when approved or paid, and one short plain line of note", () => {
  const p = applyAidUpdate(pause(), { status: "paid", amount: 2400, note: "Sent\nto landlord\u0007" }, 123);
  assert.deepEqual(p.aid, { status: "paid", amount: 2400, note: "Sent to landlord", at: 123, by: "Sample Rental Help" });
  assert.equal(applyAidUpdate(pause(), { status: "documents" }, 1).aid.amount, null);
  const refused = [{ status: "approved" }, { status: "paid", amount: 12.5 }, { status: "paid", amount: 0 }, { status: "paid", amount: 100001 },
    { status: "maybe" }, { status: "applied", note: "x".repeat(NOTE_MAX + 1) }, { status: "applied", note: 5 }, null];
  for (const u of refused) assert.throws(() => applyAidUpdate(pause(), u, 1), /bad_action/, JSON.stringify(u));
  assert.throws(() => applyAidUpdate(pause({ state: "lifted" }), { status: "applied" }, 1), /bad_action/, "only a paused case gets updates");
});

test("a 90-day pause on hearing day becomes a paused case from that day, and its entry says what the order says", () => {
  const c = { id: "c3", cause: "99D00-2610-EV-000103", landlord: "Elm Court Homes LLC", tenant: "C. Nguyen", byCounsel: true, tenantHere: true, landlordHere: true, advised: true, outcome: "diversion" };
  assert.deepEqual(pauseFromHearing(c, "2026-11-06", "Sample Rental Help"),
    { id: "p-c3", cause: c.cause, landlord: c.landlord, tenant: c.tenant, start: "2026-11-06", state: "paused", agency: "Sample Rental Help", aid: null, day30: null, day60: null });
  const text = hearingEntry(c, "2026-11-06");
  assert.match(text, /^November 6, 2026\. Case called\./);
  assert.match(text, /Plaintiff Elm Court Homes LLC appears by counsel\./);
  assert.match(text, /Defendant C\. Nguyen appears in person\./);
  assert.match(text, /Pre-eviction diversion advisement given\./);
  assert.match(text, /stayed for ninety days under Indiana Supreme Court Order 22S-MS-308, through February 4, 2027\./);
  assert.match(text, /Status conferences set for December 7, 2026 and January 5, 2027\./);
  assert.match(hearingEntry({ ...c, tenantHere: false, advised: false, outcome: "default" }, "2026-11-06"), /Defendant C\. Nguyen does not appear\.\nJudgment by default for Plaintiff\.$/);
});

test("drafts for a paused case say what happened and where the aid stands, never the agency's note", () => {
  const p = pause({ day30: { how: "report", on: "2026-11-02" }, aid: { status: "approved", amount: 1850, note: "call me", at: new Date(2026, 10, 3, 10).getTime(), by: "Sample Rental Help" } });
  const e = pauseEntry("day30", p, "2026-11-02");
  assert.match(e, /Written status report filed in place of the 30-day status conference\./);
  assert.match(e, /Rental assistance: approved by Sample Rental Help, \$1,850 \(November 3, 2026\)\./);
  assert.match(e, /The stay remains in effect through December 30, 2026\./);
  assert.doesNotMatch(e, /call me/);
  assert.match(pauseEntry("lifted", p, "2026-11-20"), /no longer actively following the case management order or participating in the Pre-Eviction Diversion Program in good faith/);
  const order = sealingOrder(p, "2026-12-01", "2026-12-02");
  assert.match(order, /^ORDER TO SEAL EVICTION RECORD\n\nCause No\. 99D00-2609-EV-000201\n/);
  assert.match(order, /dismissed on December 1, 2026\. Under Indiana Code 32-31-11-3, the Court, on its own motion,/);
  for (const k of ["day30", "day60", "dismissed", "agreement", "lifted"]) assert.doesNotMatch(pauseEntry(k, pause(), "2026-11-02"), /undefined|null|NaN|\{/, k);
});
