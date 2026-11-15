// The hearing-day board: how a case moves from "not here yet" to done, the order of the lanes, and what a case cannot do.
import test from "node:test";
import assert from "node:assert/strict";
import { applyAction, laneCases, beforeJudge, nextInLine, waitedMinutes, OUTCOMES } from "../../shared/court/hearing-board.js";

const T = 1000000;
const fresh = (over = {}) => ({
  id: "c1", cause: "99D00-2610-EV-000101", landlord: "Oak Street Apartments LLC", tenant: "A. Rivera", byCounsel: true,
  stage: "waiting", tenantHere: false, landlordHere: false, with: null, outcome: null, advised: false, since: 0, readyAt: null, ...over
});

test("checking in moves a case to Here, and checking everyone out moves it back", () => {
  const a = applyAction(fresh(), { type: "arrive", party: "tenant", here: true }, T);
  assert.deepEqual([a.stage, a.tenantHere, a.since], ["here", true, T]);
  const b = applyAction(a, { type: "arrive", party: "landlord", here: true }, T + 1);
  assert.deepEqual([b.stage, b.since], ["here", T], "a second check-in does not restart the clock");
  const c = applyAction(applyAction(b, { type: "arrive", party: "tenant", here: false }, T + 2), { type: "arrive", party: "landlord", here: false }, T + 3);
  assert.equal(c.stage, "waiting");
});

test("a case talks, joins the line, is called, is advised about diversion, and ends with an outcome that can be undone", () => {
  let c = applyAction(fresh({ stage: "here", tenantHere: true }), { type: "talk", with: "mediator" }, T);
  assert.deepEqual([c.stage, c.with], ["talking", "mediator"]);
  c = applyAction(c, { type: "talk", with: "lawyer" }, T + 5);
  assert.equal(c.since, T, "switching who they talk with keeps the talking clock");
  c = applyAction(c, { type: "ready" }, T + 10);
  assert.deepEqual([c.stage, c.readyAt, c.with], ["ready", T + 10, null]);
  c = applyAction(c, { type: "call" }, T + 20);
  assert.equal(c.stage, "hearing");
  c = applyAction(c, { type: "advised", value: true }, T + 21);
  assert.equal(c.advised, true);
  c = applyAction(c, { type: "outcome", outcome: "diversion" }, T + 30);
  assert.deepEqual([c.stage, c.outcome], ["done", "diversion"]);
  c = applyAction(c, { type: "reopen" }, T + 40);
  assert.deepEqual([c.stage, c.outcome], ["hearing", null]);
});

test("a case nobody came for can still be called and ended", () => {
  const c = applyAction(fresh(), { type: "call" }, T);
  assert.equal(applyAction(c, { type: "outcome", outcome: "default" }, T + 1).outcome, "default");
});

test("a change a case cannot take is refused, and nothing outside the known words gets through", () => {
  const refused = [
    [fresh(), { type: "ready" }], // nobody is here yet
    [fresh(), { type: "outcome", outcome: "agreement" }], // not before the judge
    [fresh({ stage: "done", outcome: "dismissed" }), { type: "call" }],
    [fresh({ stage: "done", outcome: "dismissed" }), { type: "advised", value: true }],
    [fresh(), { type: "arrive", party: "__proto__", here: true }],
    [fresh(), { type: "arrive", party: "tenant", here: "yes" }],
    [fresh({ stage: "here" }), { type: "talk", with: "judge" }],
    [fresh({ stage: "hearing" }), { type: "outcome", outcome: "eviction" }],
    [fresh({ stage: "hearing" }), { type: "reopen" }],
    [fresh(), { type: "erase" }], [fresh(), {}], [fresh(), null]
  ];
  for (const [c, a] of refused) assert.throws(() => applyAction(c, a, T), /bad_action/, JSON.stringify(a));
  assert.equal(OUTCOMES.length, 6);
});

test("the line for the judge goes by when each case joined it, finished cases newest first", () => {
  const board = [
    fresh({ id: "a", stage: "ready", readyAt: 30 }), fresh({ id: "b", stage: "ready", readyAt: 10 }),
    fresh({ id: "c", stage: "done", since: 5 }), fresh({ id: "d", stage: "done", since: 50 }), fresh({ id: "e", stage: "hearing" })
  ];
  assert.deepEqual(laneCases(board, "ready").map((c) => c.id), ["b", "a"]);
  assert.deepEqual(laneCases(board, "done").map((c) => c.id), ["d", "c"]);
  assert.equal(nextInLine(board).id, "b");
  assert.deepEqual(beforeJudge(board).map((c) => c.id), ["e"]);
  assert.equal(nextInLine([fresh()]), null);
  assert.equal(waitedMinutes(fresh({ since: 0 }), 12 * 60000 + 59000), 12);
});
