// ---------- The hearing-day board ----------
// One morning's eviction docket, case by case: who is here, who is talking, who is ready for the judge, and how each
// case ended. The server keeps the board and changes a case only through applyAction; the page shows the same stages.
// Times are milliseconds on the server's clock.

export const LANES = ["waiting", "here", "talking", "ready", "done"]; // "hearing" shows above the lanes: before the judge now
export const PARTIES = ["tenant", "landlord"];
export const TALK_WITH = ["lawyer", "mediator", "legal_aid"]; // the landlord's lawyer, a mediator, legal aid
export const OUTCOMES = ["agreement", "dismissed", "judgment", "default", "continued", "diversion"];

const ACTIVE = ["waiting", "here", "talking", "ready"];
const fail = () => { throw new Error("bad_action"); };

// One change to one case. Returns a changed copy; a change the case cannot take now throws "bad_action".
//   { type: "arrive", party, here }   a party checks in, or turns out to have left
//   { type: "talk", with }            talking with the landlord's lawyer, a mediator or legal aid
//   { type: "ready" }                 ready for the judge: joins the end of the line
//   { type: "call" }                  called in, before the judge now (from any lane: a case is called whether or not anyone came)
//   { type: "advised", value }        the judge gave the pre-eviction diversion advisement (an event in Odyssey)
//   { type: "outcome", outcome }      how the hearing ended
//   { type: "reopen" }                undo an outcome recorded by mistake
export function applyAction(c, a, now) {
  const type = a && a.type;
  const x = { ...c };
  if (type === "arrive") {
    if (!PARTIES.includes(a.party) || typeof a.here !== "boolean" || !ACTIVE.includes(c.stage)) fail();
    x[a.party + "Here"] = a.here;
    const anyone = x.tenantHere || x.landlordHere;
    if (c.stage === "waiting" && anyone) Object.assign(x, { stage: "here", since: now });
    if (c.stage === "here" && !anyone) Object.assign(x, { stage: "waiting", since: now });
    return x;
  }
  if (type === "talk") {
    if (!TALK_WITH.includes(a.with) || !["here", "talking", "ready"].includes(c.stage)) fail();
    return Object.assign(x, { stage: "talking", with: a.with, since: c.stage === "talking" ? c.since : now, readyAt: null });
  }
  if (type === "ready") {
    if (!["here", "talking"].includes(c.stage)) fail();
    return Object.assign(x, { stage: "ready", with: null, since: now, readyAt: now });
  }
  if (type === "call") {
    if (!ACTIVE.includes(c.stage)) fail();
    return Object.assign(x, { stage: "hearing", with: null, since: now, readyAt: null });
  }
  if (type === "advised") {
    if (typeof a.value !== "boolean" || c.stage === "done") fail();
    return Object.assign(x, { advised: a.value });
  }
  if (type === "outcome") {
    if (!OUTCOMES.includes(a.outcome) || c.stage !== "hearing") fail();
    return Object.assign(x, { stage: "done", outcome: a.outcome, since: now });
  }
  if (type === "reopen") {
    if (c.stage !== "done") fail();
    return Object.assign(x, { stage: "hearing", outcome: null, since: now });
  }
  return fail();
}

// The cases in one lane, in the order staff read them: the line for the judge by when each case joined it,
// finished cases newest first, everything else in docket order.
export function laneCases(board, lane) {
  const inLane = board.filter((c) => c.stage === lane);
  if (lane === "ready") return inLane.sort((a, b) => a.readyAt - b.readyAt);
  if (lane === "done") return inLane.sort((a, b) => b.since - a.since);
  return inLane;
}

export const beforeJudge = (board) => board.filter((c) => c.stage === "hearing");
export const nextInLine = (board) => laneCases(board, "ready")[0] || null;
export const waitedMinutes = (c, now) => Math.max(0, Math.floor((now - c.since) / 60000));
