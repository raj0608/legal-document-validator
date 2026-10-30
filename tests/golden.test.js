// The new modules must give the same answers as the original single-file code on the sample papers.
// tests/golden/original.json was generated from legacy/ready-for-court.original.html.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { protect } from "../shared/safety.js";
import { findDates, findCites, formType, checkForm, findDeadline } from "../shared/analysis.js";
import { toISO } from "../shared/dates.js";
import * as C from "./golden/cases.js";

const golden = JSON.parse(fs.readFileSync(new URL("./golden/original.json", import.meta.url), "utf8"));

// Deliberate differences from the original. Each one is a leak the original had and the new code closes.
const INTENDED = {
  // The original only hid a name after a label like "Printed name:", so the signature line "/s/ Kimi Sample" went to the AI.
  filledForm: (safe) => safe.replace("/s/ Kimi Sample", "/s/ [NAME_1]"),
  // The card-number pattern used to swallow the space after the number, so the restored text lost it.
  miscPii: (safe) => safe.replace("[CARD_1]and", "[CARD_1] and")
};

test("protect() matches the original on every sample (except the intended fixes)", () => {
  for (const [name, text] of Object.entries(C.SAFETY_CASES)) {
    const p = protect(text), g = golden.safety[name];
    const expectedSafe = INTENDED[name] ? INTENDED[name](g.safe) : g.safe;
    assert.equal(p.safe, expectedSafe, name + ": text sent to the AI");
    assert.deepEqual(p.counts, g.counts, name + ": counts");
    assert.deepEqual(p.back, g.back, name + ": restore map");
    assert.equal(p.removed, g.removed, name + ": removed instruction-like text");
    assert.equal(p.truncated, g.truncated, name + ": truncated");
  }
});

test("findDates() matches the original", () => {
  for (const [name, text] of Object.entries(C.DATE_CASES)) {
    const got = findDates(text).map((x) => ({ date: toISO(x.date), time: x.time, place: x.place, hearingLike: x.hearingLike, ctx: x.ctx }));
    assert.deepEqual(got, golden.dates[name], name);
  }
});

test("findCites() matches the original", () => {
  for (const [name, text] of Object.entries(C.CITE_CASES)) assert.deepEqual(findCites(text), golden.cites[name], name);
});

test("formType() and checkForm() match the original", () => {
  for (const [name, text] of Object.entries(C.FORM_CASES)) {
    const g = golden.forms[name];
    assert.equal(formType(text), g.type, name + ": type");
    const got = checkForm(text, { hearingDays: C.HEARING_DAYS }).map((c) => ({ lbl: c.lbl, st: c.st, src: c.src ? c.src.label : null, snips: c.snips || null }));
    assert.deepEqual(got, g.checks, name);
  }
});

// Deliberate difference: business days now skip court holidays. Veterans Day (Wed Nov 11, 2026) falls inside the
// sample clerk notice's three business days, so its fix-by date moves from Thursday Nov 12 to Friday Nov 13. Thanksgiving
// (Thu Nov 26) falls inside the ten business days after Nov 12, which moves that date from Nov 26 to Nov 27.
const INTENDED_DEADLINE = { clerk: { date: "2026-11-13" }, business: { date: "2026-11-27" } };

test("findDeadline() matches the original (except the holiday fix)", () => {
  for (const [name, text] of Object.entries(C.DEADLINE_CASES)) {
    const d = findDeadline(text);
    const got = d && { n: d.n, unit: d.unit, kind: d.kind, quote: d.quote, date: d.date ? toISO(d.date) : null, base: d.base ? toISO(d.base) : null };
    const want = golden.deadlines[name] && Object.assign({}, golden.deadlines[name], INTENDED_DEADLINE[name]);
    assert.deepEqual(got, want, name);
  }
  assert.deepEqual(findDeadline(C.DEADLINE_CASES.clerk).skipped.map((h) => h.id), ["veterans"]);
});
