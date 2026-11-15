// ---------- A paused case: what the clerk and the rental-aid agency change ----------
// state: paused | resolved | lifted. Order 22S-MS-308 makes the court records confidential while the case takes part in
// the program, and they stay confidential after it unless the court lifts the stay (or finds a broken agreement).
// A dismissal is flagged for sealing: since July 2025, Indiana Code 32-31-11-3 has the court seal a qualifying
// dismissed eviction record on its own motion. Order 22S-MS-308 also lets courts give these otherwise confidential
// records to rental-assistance providers, which is what the agency's page relies on.

export const AID = ["applied", "documents", "approved", "paid", "denied"];
export const NOTE_MAX = 200;
export const AMOUNT_MAX = 100000;

const fail = () => { throw new Error("bad_action"); };

// A case the judge paused on hearing day, as a new paused case from that day.
export function pauseFromHearing(c, dayISO, agency) {
  return { id: "p-" + c.id, cause: c.cause, landlord: c.landlord, tenant: c.tenant, start: dayISO, state: "paused", agency, aid: null, day30: null, day60: null };
}

// The clerk's changes. Returns a changed copy; a change the case cannot take now throws "bad_action".
//   { type: "conference", which: "day30" | "day60", how: "held" | "report" }   a status conference, or a written report in its place
//   { type: "dismiss" } | { type: "agreement" }   resolved through the program: dismissed, or an agreement filed
//   { type: "lift" }                              the stay is lifted and the case goes back on the regular docket
//   { type: "sealed" }                            the sealing order for a dismissed case is entered
export function applyPauseAction(p, a, dayISO) {
  const type = a && a.type;
  const x = { ...p };
  if (type === "conference") {
    if (p.state !== "paused" || !["day30", "day60"].includes(a.which) || !["held", "report"].includes(a.how)) fail();
    x[a.which] = { how: a.how, on: dayISO };
    return x;
  }
  if (type === "dismiss" || type === "agreement") {
    if (p.state !== "paused") fail();
    return Object.assign(x, { state: "resolved", resolution: type === "dismiss" ? "dismissed" : "agreement", closedOn: dayISO, sealed: false });
  }
  if (type === "lift") {
    if (p.state !== "paused") fail();
    return Object.assign(x, { state: "lifted", closedOn: dayISO });
  }
  if (type === "sealed") {
    if (!needsSealing(p)) fail();
    return Object.assign(x, { sealed: true, sealedOn: dayISO });
  }
  return fail();
}

// The agency's update on a tenant's rental aid. An amount goes with "approved" and "paid", in whole dollars.
// The note is one plain line for the clerk.
export function applyAidUpdate(p, u, now) {
  if (p.state !== "paused" || !u || !AID.includes(u.status)) fail();
  const withAmount = u.status === "approved" || u.status === "paid";
  const amount = withAmount ? u.amount : null;
  if (withAmount && !(Number.isInteger(amount) && amount > 0 && amount <= AMOUNT_MAX)) fail();
  if (u.note !== undefined && (typeof u.note !== "string" || u.note.length > NOTE_MAX)) fail();
  const note = (u.note || "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  return { ...p, aid: { status: u.status, amount, note, at: now, by: p.agency } };
}

export const isConfidential = (p) => p.state !== "lifted";
export const needsSealing = (p) => p.state === "resolved" && p.resolution === "dismissed" && !p.sealed;
