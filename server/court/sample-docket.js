// What a court's case system would supply: this morning's eviction docket, and the cases already paused for 90 days.
// A student prototype has no connection to Odyssey, so this one makes the cases up. Every name and number is fictional.
// A real version would read them from Odyssey, with the court's IT, behind this same shape:
//   { agency, morning(dayISO, now) → the hearing-day cases, pauses(dayISO, now) → the paused cases }
import { fromISO, toISO, addDays, pad } from "../../shared/dates/date-math.js";
import { scheduleFor } from "../../shared/court/pause-schedule.js";

const AGENCY = "Sample Rental Help";
const MIN = 60000, DAY = 86400000;

// A cause number in Indiana's style: county and court, the year and month filed, the case type, a number.
// County 99 does not exist, so it can never match a real case.
function cause(filedISO, n) {
  const d = fromISO(filedISO);
  return "99D00-" + String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + "-EV-" + String(n).padStart(6, "0");
}

// [landlord, tenant, the landlord's lawyer is there, stage, minutes since that stage began, the rest]
const MORNING = [
  ["Oak Street Apartments LLC", "A. Rivera", true, "done", 42, { tenantHere: true, landlordHere: true, advised: true, outcome: "agreement" }],
  ["Pine Ridge Rentals LLC", "B. Johnson", true, "done", 35, { landlordHere: true, advised: true, outcome: "default" }],
  ["Elm Court Homes LLC", "C. Nguyen", true, "hearing", 3, { tenantHere: true, landlordHere: true, advised: true }],
  ["Maple Row Properties LLC", "D. Smith", true, "ready", 11, { tenantHere: true, landlordHere: true }],
  ["Cedar Park Apartments LLC", "E. Williams", false, "ready", 4, { tenantHere: true, landlordHere: true }],
  ["Birch Lane Rentals LLC", "F. Brown", true, "talking", 12, { tenantHere: true, landlordHere: true, with: "lawyer" }],
  ["Willow Creek Homes LLC", "G. Davis", true, "talking", 20, { tenantHere: true, landlordHere: true, with: "mediator" }],
  ["Oak Street Apartments LLC", "H. Martinez", true, "talking", 6, { tenantHere: true, landlordHere: true, with: "legal_aid" }],
  ["Spruce Hill Properties LLC", "I. Wilson", true, "here", 15, { tenantHere: true }],
  ["Pine Ridge Rentals LLC", "J. Anderson", true, "here", 8, { landlordHere: true }],
  ["Aspen Court LLC", "K. Thomas", true, "waiting", 30, {}],
  ["Hickory Rentals LLC", "L. Moore", false, "waiting", 30, {}],
  ["Maple Row Properties LLC", "M. Taylor", true, "waiting", 30, {}],
  ["Linden Homes LLC", "N. Jackson", true, "waiting", 30, {}]
];

// [landlord, tenant, days since the pause began, the rest]. aid: [status, amount, days ago, note]
const PAUSES = [
  ["Cedar Park Apartments LLC", "O. White", 12, { aid: ["applied", null, 3, ""] }],
  ["Birch Lane Rentals LLC", "P. Harris", 28, { aid: ["documents", null, 1, "Waiting on a copy of the lease."] }],
  ["Willow Creek Homes LLC", "Q. Martin", 33, { day30: "report", aid: ["approved", 1850, 2, ""] }],
  ["Elm Court Homes LLC", "R. Thompson", 60, { day30: "held", aid: ["paid", 2400, 5, ""] }],
  ["Spruce Hill Properties LLC", "S. Garcia", 86, { day30: "held", day60: "held", aid: ["paid", 3100, 20, ""] }],
  ["Hickory Rentals LLC", "T. Robinson", 70, { state: "resolved", resolution: "dismissed", closed: 2, day30: "held", day60: "held", aid: ["paid", 1600, 9, ""] }],
  ["Aspen Court LLC", "U. Clark", 45, { state: "lifted", closed: 10, day30: "held", aid: ["denied", null, 25, ""] }]
];

function morning(dayISO, now) {
  const filed = toISO(addDays(fromISO(dayISO), -21));
  return MORNING.map(([landlord, tenant, byCounsel, stage, ago, more], i) => ({
    id: "c" + (i + 1), cause: cause(filed, 101 + i), landlord, tenant, byCounsel,
    stage, tenantHere: false, landlordHere: false, with: null, outcome: null, advised: false,
    since: now - ago * MIN, readyAt: stage === "ready" ? now - ago * MIN : null, ...more
  }));
}

function pauses(dayISO, now) {
  return PAUSES.map(([landlord, tenant, days, more], i) => {
    const start = toISO(addDays(fromISO(dayISO), -days));
    const s = scheduleFor(start);
    const [status, amount, ago, note] = more.aid;
    const done = (how, on) => (how ? { how, on } : null);
    return {
      id: "p" + (i + 1), cause: cause(toISO(addDays(fromISO(start), -21)), 201 + i), landlord, tenant, start,
      state: more.state || "paused", resolution: more.resolution || null, sealed: false, agency: AGENCY,
      closedOn: more.closed ? toISO(addDays(fromISO(dayISO), -more.closed)) : null,
      day30: done(more.day30, s.day30), day60: done(more.day60, s.day60),
      aid: { status, amount, note, at: now - ago * DAY, by: AGENCY }
    };
  });
}

export const sampleDocket = { agency: AGENCY, morning, pauses };
