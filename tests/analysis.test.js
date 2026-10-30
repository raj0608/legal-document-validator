import test from "node:test";
import assert from "node:assert/strict";
import { formType, checkForm } from "../shared/analysis.js";

const status = (text, lbl) => checkForm(text, { hearingDays: null }).find((c) => c.lbl === lbl).st;
const pad = "line\n".repeat(8);

test("a paper is typed by what it says at the top, not by words on the back", () => {
  const notice = "IN THE ALLEN SUPERIOR COURT\nNOTICE OF EVICTION CLAIM\n" + "x ".repeat(1000) + "\nYou may ask for a continuance.";
  assert.equal(formType(notice), "type_unknown");
  assert.equal(formType("MOTION FOR CONTINUANCE\n" + "x ".repeat(1000)), "type_cont");
  assert.equal(formType("PETITION TO SEAL EVICTION RECORDS"), "type_seal");
});

test("a signature line whose only text is the next label is not a filled-in signature", () => {
  assert.equal(status(pad + "Signature:   Date:\n", "c_sign"), "miss");
  assert.equal(status(pad + "Signature: ____________  Date: ______\n", "c_sign"), "miss");
  assert.equal(status(pad + "Signature: /s/ Kim Sample   Date:\n", "c_sign"), "ok");
  assert.equal(status(pad + "Signature: Kim Sample\n", "c_sign"), "ok");
});

test("times and ordinary values are not mistaken for labels", () => {
  assert.equal(status(pad + "Date: 9:30 am\n", "c_date"), "ok");
  assert.equal(status(pad + "Date:\n", "c_date"), "miss");
});

test("boxes in a group where one is checked are not blanks; an unchecked group still is", () => {
  const blanksOf = (text) => checkForm(text, { hearingDays: null }).find((c) => c.lbl === "c_blanks");
  const chosen = pad + "[ ] I have contacted the other party.\n[x] I have not contacted the other party.\nSignature: /s/ Kim\n";
  assert.equal(blanksOf(chosen).st, "ok");
  const none = pad + "[ ] I have contacted the other party.\n[ ] I have not contacted the other party.\n";
  assert.equal(blanksOf(none).st, "miss");
  assert.equal(blanksOf(none).snips.length, 2);
  // a wrapped line between two boxes of the same list does not split the group
  const wrapped = pad + "[ ] at my street address.\n[x] at the Attorney General address (only for\nsome people).\n[ ] at my email.\n";
  assert.equal(blanksOf(wrapped).st, "ok");
  // far-apart lists are separate: a chosen box up here does not excuse an empty box down there
  const apart = pad + "[x] Yes\nSome other question\nMore text\nMore text\n[ ] Option A\n[ ] Option B\n";
  assert.equal(blanksOf(apart).snips.length, 2);
  // a blank line next to a chosen box is still a blank
  assert.equal(blanksOf(pad + "[x] Yes\nReason: ____________\n").st, "miss");
  // printed box glyphs behave the same
  assert.equal(blanksOf(pad + "☐ Option A\n☒ Option B\n").st, "ok");
});
