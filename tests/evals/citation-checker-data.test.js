// EVAL: how well does the citation check do on real and made-up data? Scored with the CourtListener answers saved in data/snapshots/,
// so it needs no network and no token. The data and where it came from are described in data/README.md.
//   1. 48 real Indiana citations                      should all be "found"
//   2. 42 citations that courts found to be fake      should all be flagged
//   3. 36 made-up filings with 216 planted citations  right citations "found", planted errors flagged
// The limits are set a little below today's scores, so a real drop fails the run but one odd case does not.
import test from "node:test";
import assert from "node:assert/strict";
import { scoreAll } from "../../data/score.mjs";

const r = scoreAll();
const rate = (right, total) => right / total;
const kind = (k) => r.synthetic.kinds[k];

test("real Indiana citations are called found", () => {
  console.log(`eval citation data: real Indiana citations found ${r.real.found}/${r.real.total}`);
  assert.ok(rate(r.real.found, r.real.total) >= 0.95, r.real.missed.join("; "));
});

test("citations that courts found to be fake are flagged", () => {
  console.log(`eval citation data: court-found fakes flagged ${r.fake.caught}/${r.fake.total}`);
  const missed = r.fake.rows.filter((x) => !x.caught).map((x) => x.e.cite);
  assert.ok(rate(r.fake.caught, r.fake.total) >= 0.9, "missed " + missed);
});

test("in made-up filings: invented cases and wrong years, names and courts are caught, and correct citations are left alone", () => {
  for (const k of ["ok", "fake_case", "wrong_name", "wrong_year", "wrong_court"]) console.log(`eval citation data: made-up filings, ${k} ${kind(k).right}/${kind(k).total}`);
  assert.equal(r.synthetic.notRead, 0, "every planted citation was read out of its filing");
  assert.equal(kind("fake_case").right, kind("fake_case").total, "invented cases: " + kind("fake_case").missed);
  assert.ok(rate(kind("wrong_year").right, kind("wrong_year").total) >= 0.95, "wrong years: " + kind("wrong_year").missed);
  assert.ok(rate(kind("wrong_name").right, kind("wrong_name").total) >= 0.9, "wrong names: " + kind("wrong_name").missed);
  assert.ok(rate(kind("wrong_court").right, kind("wrong_court").total) >= 0.9, "wrong courts: " + kind("wrong_court").missed);
  assert.ok(rate(kind("ok").right, kind("ok").total) >= 0.95, "false alarms: " + kind("ok").missed);
});

test("the data files are what the README says: counts and credit", () => {
  assert.equal(r.real.total, 48);
  assert.equal(r.fake.total, 42);
  assert.equal(Object.values(r.synthetic.kinds).reduce((n, k) => n + k.total, 0), 216);
});
