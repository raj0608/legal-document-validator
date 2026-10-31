// Real PDFs (tests/fixtures, made by make-fixtures.mjs) read with real pdf.js, then through the same
// protection and checks the page uses.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { extractPdfText } from "../shared/pdf-text.js";
import { protect, findResidualPii } from "../shared/safety.js";
import { findDates, findCites, checkForm, findDeadline, formType } from "../shared/analysis.js";
import { toISO } from "../shared/dates.js";

const lib = await import("pdfjs-dist/legacy/build/pdf.mjs"); // the Node-compatible build of the same pdf.js the page loads
const read = (name) => new Uint8Array(fs.readFileSync(new URL("./fixtures/" + name, import.meta.url)));
const extract = (name, opts) => extractPdfText(lib, read(name), opts);
const check = (text) => Object.fromEntries(checkForm(text, { hearingDays: 25 }).map((c) => [c.lbl, c.st]));

test("a text PDF reads like the pasted text", async () => {
  const { text, pages, pagesRead, fields } = await extract("notice-text.pdf");
  assert.equal(pages, 2); assert.equal(pagesRead, 2); assert.equal(fields, 0);
  assert.match(text, /NOTICE OF EVICTION CLAIM/);
  const dates = findDates(text);
  const hearing = dates.find((d) => d.hearingLike);
  assert.equal(toISO(hearing.date), "2026-11-24");
  assert.equal(hearing.time, "09:00");
  assert.match(hearing.place, /^Room 000/);
  assert.deepEqual(findCites(text).map((c) => c.label), ["IC 32-31-1-6", "Small Claims Rule 10(B)", "Smith v. Example Properties, 999 N.E.3d 123"]);
});

test("a text PDF goes through protection cleanly", async () => {
  const { text } = await extract("notice-text.pdf");
  const p = protect(text);
  assert.ok(p.counts.NAME >= 2 && p.counts.PHONE === 1 && p.counts.CASE === 1 && p.counts.ADDRESS === 1, JSON.stringify(p.counts));
  assert.doesNotMatch(p.safe, /Kimi|555-0147|123 Example Street|02D00-2611/);
  assert.deepEqual(findResidualPii(p.safe), []);
});

test("a clerk notice PDF gives the fix-by date", async () => {
  const { text } = await extract("clerk-notice-text.pdf");
  assert.equal(toISO(findDeadline(text).date), "2026-11-13"); // three business days from Mon Nov 9, skipping Veterans Day
});

test("pdf.js's plain text leaves out typed field values (why the page needs more than getTextContent)", async () => {
  const pdf = await lib.getDocument({ data: read("form-fillable-filled.pdf"), isEvalSupported: false }).promise;
  const tc = await (await pdf.getPage(1)).getTextContent();
  const plain = tc.items.map((i) => i.str).join(" ");
  assert.doesNotMatch(plain, /555-0147|medical appointment|02D00-2611|123 Example Street/);
});

test("a filled-in fillable form: values appear next to their labels and the checklist sees them", async () => {
  const { text, fields } = await extract("form-fillable-filled.pdf");
  assert.equal(fields, 10);
  assert.match(text, /^Cause No\. 02D00-2611-SC-000000$/m);
  assert.match(text, /^Signature: \/s\/ Kimi Sample$/m);
  assert.match(text, /^Printed name: Kimi Sample$/m);
  assert.match(text, /^Phone: \(260\) 555-0147$/m);
  assert.match(text, /^Date: November 10, 2026$/m);
  assert.match(text, /^\[ \] I have contacted the other party about this request\.$/m);
  assert.match(text, /^\[x\] I have not contacted the other party\.$/m);
  assert.doesNotMatch(text, /_{4,}/);
  const c = check(text);
  assert.equal(c.c_cause, "ok"); assert.equal(c.c_sign, "ok"); assert.equal(c.c_contact, "ok"); assert.equal(c.c_date, "ok"); assert.equal(c.c_service, "ok");
});

test("an empty fillable form: empty fields read as blanks and the checklist flags them", async () => {
  const { text } = await extract("form-fillable-empty.pdf");
  assert.match(text, /^Cause No\. _{10,}$/m);
  assert.match(text, /^Signature: _{10,}$/m);
  assert.match(text, /^\[ \] I have not contacted the other party\.$/m);
  const c = check(text);
  assert.equal(c.c_cause, "miss"); assert.equal(c.c_blanks, "miss"); assert.equal(c.c_sign, "miss"); assert.equal(c.c_contact, "miss"); assert.equal(c.c_date, "miss");
  assert.ok(checkForm(text).find((x) => x.lbl === "c_blanks").snips.length >= 8);
});

test("a flattened form (values drawn as text) gets its values back next to their labels", async () => {
  const { text, fields } = await extract("form-flattened.pdf");
  assert.equal(fields, 0);
  assert.match(text, /^Cause No\. 02D00-2611-SC-000000$/m);
  assert.match(text, /^Signature: \/s\/ Kimi Sample$/m);
  assert.match(text, /^Phone: \(260\) 555-0147$/m);
  assert.match(text, /^Mailing address: 123 Example Street, Apt\. 4, Fort Wayne, IN 46802$/m);
  const c = check(text);
  assert.equal(c.c_sign, "ok"); assert.equal(c.c_contact, "ok"); assert.equal(c.c_date, "ok"); assert.equal(c.c_cause, "ok");
});

test("filled forms are protected before anything is sent", async () => {
  for (const name of ["form-fillable-filled.pdf", "form-flattened.pdf"]) {
    const p = protect((await extract(name)).text);
    assert.doesNotMatch(p.safe, /Kimi|Sample|555-0147|123 Example Street|02D00-2611/, name);
    assert.deepEqual(findResidualPii(p.safe), [], name);
  }
});

test("a scanned (picture-only) PDF has no text", async () => {
  const r = await extract("scanned.pdf");
  assert.equal(r.text.replace(/\s/g, ""), "");
  assert.equal(r.pages, 1);
});

test("only the first 40 pages are read, and the result says so", async () => {
  const r = await extract("long-45-pages.pdf");
  assert.equal(r.pages, 45); assert.equal(r.pagesRead, 40);
  assert.match(r.text, /Page 40 of 45/);
  assert.doesNotMatch(r.text, /Page 41 of 45/);
});

test("a password-protected PDF and an unreadable file give distinct errors", async () => {
  const locked = { getDocument: () => ({ promise: Promise.reject(Object.assign(new Error("x"), { name: "PasswordException" })) }) };
  await assert.rejects(extractPdfText(locked, new Uint8Array(1)), { code: "locked" });
  await assert.rejects(extractPdfText(lib, new Uint8Array([1, 2, 3, 4])), (e) => e.code === undefined);
  const xfa = { getDocument: () => ({ promise: Promise.resolve({ numPages: 1, isPureXfa: true, getPage: async () => ({ getTextContent: async () => ({ items: [] }), getAnnotations: async () => [] }) }) }) };
  await assert.rejects(extractPdfText(xfa, new Uint8Array(1)), { code: "xfa" });
});

// Pinned copies of two public forms (downloaded 2026-10-30 from the sources listed in shared/i18n.js: SRC.allen, SRC.cont).
test("Allen County Notice of Eviction Claim (a printable form, no fillable fields)", async () => {
  const r = await extract("real/allen-notice-of-eviction-claim-1-25.pdf");
  assert.equal(r.pages, 2); assert.equal(r.fields, 0);
  assert.match(r.text, /NOTICE OF EVICTION CLAIM/);
  assert.match(r.text, /Plaintiff's Name \(1\)/);
  // its back side mentions continuances, but it is not a request to move a hearing
  assert.match(r.text, /continu/i);
  assert.equal(formType(r.text), "type_unknown");
  const p = protect(r.text);
  assert.deepEqual(findResidualPii(p.safe), []);
});

test("Indiana Legal Help continuance packet (fillable: 86 fields, printed check boxes)", async () => {
  const r = await extract("real/indiana-legal-help-continuance-2024-09.pdf");
  assert.equal(r.pages, 9); assert.equal(r.pagesRead, 9); assert.equal(r.fields, 86);
  assert.equal(formType(r.text), "type_cont");
  assert.match(r.text, /^STATE OF INDIANA\s+IN THE\s+_{10,} COUNTY\s+_{10,} COURT$/m);
  assert.match(r.text, /^Email Address: _{10,}$/m);
  assert.match(r.text, /^Phone Number: _{10,}$/m);
  // each check box appears once: the field's state replaces the box the form printed next to it
  assert.match(r.text, /^\[ \]\s+at my street address\./m);
  assert.match(r.text, /^\[ \]\s+did not agree to my continuance request\./m);
  assert.doesNotMatch(r.text, /[☐□]/);
  // the signature lines have no field (they are signed by hand), so the checklist must not call them filled in
  const c = Object.fromEntries(checkForm(r.text, { hearingDays: null }).map((x) => [x.lbl, x.st]));
  assert.equal(c.c_sign, "miss");
  assert.equal(c.c_blanks, "miss");
});

// Any PDFs dropped in tests/fixtures/real/ (for example the court's own forms) are read and reported, never asserted on.
test("real forms in tests/fixtures/real, if any, can be read and protected", async (t) => {
  const dir = new URL("./fixtures/real/", import.meta.url);
  if (!fs.existsSync(dir)) return t.skip("no real forms there");
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".pdf"))) {
    const r = await extractPdfText(lib, new Uint8Array(fs.readFileSync(new URL(f, dir))));
    const p = protect(r.text);
    assert.deepEqual(findResidualPii(p.safe), [], f);
    console.log(`  ${f}: ${r.pagesRead}/${r.pages} pages, ${r.fields} fields, ${r.text.length} characters`);
  }
});

test("PDFs are always opened with eval switched off (the protection against the known pdf.js advisory GHSA-wgrm-67xf-hhpq)", async () => {
  let seen;
  const lib = { getDocument: (opts) => { seen = opts; return { promise: Promise.resolve({ numPages: 0, isPureXfa: false }) }; } };
  await extractPdfText(lib, new Uint8Array(1), { docOptions: { isEvalSupported: true, cMapUrl: "/x/" } }).catch(() => {});
  assert.equal(seen.isEvalSupported, false, "a caller cannot switch it back on");
  assert.equal(seen.cMapUrl, "/x/");
});
