// Reading case citations out of a filing, matching names, and building the report a clerk reads.
import test from "node:test";
import assert from "node:assert/strict";
import { findCaseCitations } from "../../shared/analysis/case-citations.js";
import { sameCase } from "../../shared/analysis/case-name-match.js";
import { buildReport } from "../../shared/analysis/citation-report.js";
import { FILING_SAMPLE } from "../../shared/sample-papers.js";

test("a citation gives its volume, reporter, page, case name and year", () => {
  const [c] = findCaseCitations("The court held so in Goldberg v. Kelly, 397 U.S. 254 (1970).");
  assert.equal(c.cite, "397 U.S. 254");
  assert.equal(c.name, "Goldberg v. Kelly");
  assert.equal(c.year, 1970);
});

test("the common federal and Indiana reporters are read, however the spacing is written", () => {
  const text = "A v. B, 12 N.E.3d 345 (Ind. 2014); C v. D, 99 N.E. 2d 100 (Ind. Ct. App. 1950); E v. F, 5 F.4th 6 (7th Cir. 2021); G v. H, 7 F. Supp. 3d 8 (S.D. Ind. 2014); I v. J, 150 Ind. 22 (1898).";
  assert.deepEqual(findCaseCitations(text).map((c) => c.cite), ["12 N.E.3d 345", "99 N.E.2d 100", "5 F.4th 6", "7 F. Supp. 3d 8", "150 Ind. 22"]);
  assert.deepEqual(findCaseCitations(text).map((c) => c.year), [2014, 1950, 2021, 2014, 1898]);
});

test("parallel citations to one case are one entry, checked by the first, and the year belongs to the group", () => {
  const [c, ...rest] = findCaseCitations("Goldberg v. Kelly, 397 U.S. 254, 90 S. Ct. 1011, 25 L. Ed. 2d 287 (1970).");
  assert.equal(rest.length, 0);
  assert.equal(c.cite, "397 U.S. 254");
  assert.deepEqual(c.also, ["90 S. Ct. 1011", "25 L. Ed. 2d 287"]);
  assert.equal(c.year, 1970);
});

test("a pinpoint page is not mistaken for a second citation, and a repeated citation is counted once", () => {
  const out = findCaseCitations("Lindsey v. Normet, 405 U.S. 56, 63 (1972). Later: Lindsey v. Normet, 405 U.S. 56 (1972).");
  assert.equal(out.length, 1);
  assert.equal(out[0].count, 2);
});

test("signal words and the sentence before are not part of the case name", () => {
  assert.equal(findCaseCitations("See Goldberg v. Kelly, 397 U.S. 254 (1970).")[0].name, "Goldberg v. Kelly");
  assert.equal(findCaseCitations("The court held in Mathews v. Eldridge, 424 U.S. 319 (1976).")[0].name, "Mathews v. Eldridge");
});

test("a citation with no case name before it still counts, with no name", () => {
  const [c] = findCaseCitations("as stated at 397 U.S. 254.");
  assert.equal(c.cite, "397 U.S. 254");
  assert.equal(c.name, null);
});

test("text with no case citation gives an empty list", () => {
  assert.deepEqual(findCaseCitations("Pay rent by the 5th. IC 32-31-8-5 and Trial Rule 12(B) apply. Call 260 555 0147."), []);
});

test("case names match on their distinctive words, side by side", () => {
  assert.ok(sameCase("Goldberg v. Kelly", "Goldberg v. Kelly"));
  assert.ok(sameCase("Lindsey v. Normet", "Lindsey v. Normet"));
  assert.ok(sameCase("Ind. Dep’t of Revenue v. Acme Co.", "Indiana Department of Revenue v. Acme Company, Inc."));
  assert.ok(sameCase("In re Estate of Smith", "In re Smith"));
  assert.ok(!sameCase("Harper v. Riverside Management", "Mathews v. Eldridge"));
  assert.ok(sameCase("In re", "Anything v. Else"), "nothing distinctive to compare is not a difference");
});

const cites = [
  { cite: "397 U.S. 254", name: "Goldberg v. Kelly", year: 1970, count: 1, also: [] },
  { cite: "424 U.S. 319", name: "Harper v. Riverside Management", year: 1976, count: 1, also: [] },
  { cite: "912 N.E.2d 4471", name: "Hoosier Tenants Union v. Lakeview Holdings", year: 2009, count: 1, also: [] },
  { cite: "405 U.S. 56", name: "Lindsey v. Normet", year: 1971, count: 1, also: [] },
  { cite: "1 Ind. 1", name: null, year: null, count: 1, also: [] },
  { cite: "5 F.3d 5", name: null, year: null, count: 1, also: [] }
];
const results = [
  { status: "found", clusters: [{ name: "Goldberg v. Kelly", year: 1970, url: "https://www.courtlistener.com/c/U.S./397/254/" }] },
  { status: "found", clusters: [{ name: "Mathews v. Eldridge", year: 1976, url: "https://www.courtlistener.com/c/U.S./424/319/" }] },
  { status: "not_found", clusters: [] },
  { status: "found", clusters: [{ name: "Lindsey v. Normet", year: 1972, url: "https://www.courtlistener.com/c/U.S./405/56/" }] },
  { status: "unrecognised", clusters: [] }
  // the last one has no answer: it was not checked
];

test("the report says found, name differs, year differs, not found, reporter not recognised and not checked", () => {
  const { rows, counts } = buildReport(cites, results);
  const by = Object.fromEntries(rows.map((r) => [r.cite, r.verdict]));
  assert.deepEqual(by, {
    "397 U.S. 254": "found", "424 U.S. 319": "name_differs", "912 N.E.2d 4471": "not_found",
    "405 U.S. 56": "year_differs", "1 Ind. 1": "unknown_reporter", "5 F.3d 5": "unchecked"
  });
  assert.deepEqual(counts, { found: 1, check: 4, unchecked: 1 });
});

test("the clearest signs come first and what was found comes last", () => {
  const { rows } = buildReport(cites, results);
  assert.equal(rows[0].verdict, "name_differs");
  assert.equal(rows.at(-1).verdict, "found");
  assert.equal(rows.at(-2).verdict, "unchecked");
});

test("when the lookup is off, nothing is checked and nothing is called wrong", () => {
  const { rows, counts } = buildReport(cites, null);
  assert.ok(rows.every((r) => r.verdict === "unchecked"));
  assert.deepEqual(counts, { found: 0, check: 0, unchecked: 6 });
});

test("a limited answer is not checked, and several matches with no name in the filing is flagged as ambiguous", () => {
  const two = [{ status: "ambiguous", clusters: [{ name: "A v. B", year: 1990, url: null }, { name: "C v. D", year: 1991, url: null }] }];
  assert.equal(buildReport([{ cite: "1 F.3d 1", name: null, year: null, count: 1, also: [] }], two).rows[0].verdict, "ambiguous");
  assert.equal(buildReport([{ cite: "1 F.3d 1", name: "C v. D", year: 1991, count: 1, also: [] }], two).rows[0].verdict, "found");
  assert.equal(buildReport(cites.slice(0, 1), [{ status: "limited", clusters: [] }]).rows[0].verdict, "unchecked");
});

test("the sample filing has two real cases, one real number with the wrong name, and one that is not a real case", () => {
  const found = findCaseCitations(FILING_SAMPLE);
  assert.deepEqual(found.map((c) => c.cite), ["405 U.S. 56", "397 U.S. 254", "424 U.S. 319", "912 N.E.2d 4471"]);
  assert.deepEqual(found.map((c) => c.name), ["Lindsey v. Normet", "Goldberg v. Kelly", "Harper v. Riverside Management", "Hoosier Tenants Union v. Lakeview Holdings"]);
});
