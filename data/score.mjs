// Scores the citation checker on the three data sets, using the saved CourtListener answers (no network, no token).
//   node data/score.mjs [snapshot file]
// The real checker code runs: citations are read out of the text, matched to the saved answers, and judged by buildReport.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findCaseCitations } from "../shared/analysis/case-citations.js";
import { buildReport } from "../shared/analysis/citation-report.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (...p) => JSON.parse(fs.readFileSync(path.join(here, ...p), "utf8"));

export function latestSnapshot() {
  const files = fs.readdirSync(path.join(here, "snapshots")).filter((f) => /^courtlistener-.*\.json$/.test(f)).sort();
  return path.join("snapshots", files.at(-1));
}

// Runs the checker on a piece of text; returns { [cite]: row } for the citations it found.
function check(text, snapshot) {
  const cites = findCaseCitations(text);
  const { rows } = buildReport(cites, cites.map((c) => snapshot.results[c.cite] || null));
  return Object.fromEntries(rows.map((r) => [r.cite, r]));
}
const say = (e) => (e.name ? e.name + ", " : "") + e.cite + (e.year ? " (" + (e.court || "") + " " + e.year + ")" : "");

export function scoreAll(snapshotFile = latestSnapshot()) {
  const snapshot = read(snapshotFile);

  // 1. real Indiana citations: every one should be "found"
  const real = read("citations", "real-indiana-citations.json");
  const realMiss = real.filter((e) => (check(say({ ...e, court: e.court }), snapshot)[e.cite] || {}).verdict !== "found");

  // 2. citations courts found to be fake: every one should be flagged
  const fake = read("citations", "fake-indiana-citations.json").items;
  const fakeRows = fake.map((e) => {
    const row = check(say({ cite: e.cite, name: e.name, year: e.year, court: e.courtInFiling }), snapshot)[e.cite];
    return { e, verdict: row ? row.verdict : "not read", caught: !!row && row.verdict !== "found" };
  });

  // 3. made-up filings: read whole filings, then compare with the answer key
  const key = read("synthetic", "answer-key.json").items;
  const byFiling = {};
  for (const k of key) (byFiling[k.filing] ||= []).push(k);
  const kinds = {};
  let notRead = 0;
  for (const [id, items] of Object.entries(byFiling)) {
    const rows = check(fs.readFileSync(path.join(here, "synthetic", "filings", id + ".txt"), "utf8"), snapshot);
    for (const k of items) {
      const row = rows[k.cite];
      if (!row) { notRead++; }
      const verdict = row ? row.verdict : "not read";
      const ok = k.expect === "found" ? verdict === "found" : verdict !== "found" && verdict !== "not read";
      const s = (kinds[k.planted] ||= { total: 0, right: 0, verdicts: {}, missed: [] });
      s.total++; if (ok) s.right++; else s.missed.push(`${id} #${k.n} ${k.name}, ${k.cite} (${k.year}) -> ${verdict}`);
      s.verdicts[verdict] = (s.verdicts[verdict] || 0) + 1;
    }
  }
  return { snapshotFile, real: { total: real.length, found: real.length - realMiss.length, missed: realMiss.map((e) => e.cite + " " + e.name) }, fake: { total: fake.length, caught: fakeRows.filter((r) => r.caught).length, rows: fakeRows }, synthetic: { kinds, notRead } };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = scoreAll(process.argv[2]);
  const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : 0) + "%";
  console.log("Snapshot:", r.snapshotFile, "\n");
  console.log(`1. Real Indiana citations called "found": ${r.real.found}/${r.real.total} (${pct(r.real.found, r.real.total)})`);
  r.real.missed.forEach((m) => console.log("     missed:", m));
  console.log(`\n2. Citations courts found fake, flagged by the check: ${r.fake.caught}/${r.fake.total} (${pct(r.fake.caught, r.fake.total)})`);
  for (const x of r.fake.rows) console.log(`     ${x.caught ? "caught " : "MISSED "} ${x.verdict.padEnd(16)} ${x.e.name || "(no name)"}, ${x.e.cite}`);
  console.log(`\n3. Made-up filings (${Object.values(r.synthetic.kinds).reduce((n, k) => n + k.total, 0)} citations, ${r.synthetic.notRead} not read):`);
  for (const [kind, s] of Object.entries(r.synthetic.kinds)) {
    console.log(`     ${kind.padEnd(11)} right ${s.right}/${s.total} (${pct(s.right, s.total)})   verdicts ${JSON.stringify(s.verdicts)}`);
    s.missed.slice(0, 6).forEach((m) => console.log("         missed:", m));
  }
}
