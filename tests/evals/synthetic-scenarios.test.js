// EVAL: 122 scenario filings and 8 PDFs, each a trap for the citation check, with the answer it must give (data/synthetic/build-scenarios.mjs).
// Hidden characters, odd spaces, full-width digits, addresses and leases that look like citations, citations the check cannot read,
// planted errors inside noisy text, empty and huge files, hostile text, Spanish filings, and PDF layouts. The lookup answers come from the
// saved CourtListener snapshot; a citation it does not hold is "not found", which is right for the invented ones. No network, no token.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { findCaseCitations } from "../../shared/analysis/case-citations.js";
import { buildReport } from "../../shared/analysis/citation-report.js";
import { extractPdfText } from "../../shared/pdf-text.js";
import { latestSnapshot } from "../../data/score.mjs";

const lib = await import("pdfjs-dist/legacy/build/pdf.mjs");
const dir = new URL("../../data/synthetic/", import.meta.url);
const key = JSON.parse(fs.readFileSync(new URL("scenarios-key.json", dir), "utf8"));
const snapshot = JSON.parse(fs.readFileSync(new URL("../" + latestSnapshot(), dir), "utf8")).results;
const lookup = (cite) => snapshot[cite] || { status: "not_found", clusters: [] };

// What the check says about a text: the citations it reads and a verdict for each.
function run(text) {
  const cites = findCaseCitations(text);
  const { rows } = buildReport(cites, cites.map((c) => lookup(c.cite)));
  return { cites, rows: Object.fromEntries(rows.map((r) => [r.cite, r])) };
}
// The mistakes in one filing: citations missed or invented, a wrong count, a wrong verdict.
function problems(expect, got) {
  const out = [];
  const want = expect.map((e) => e.cite).sort(), have = got.cites.map((c) => c.cite).sort();
  if (JSON.stringify(want) !== JSON.stringify(have)) out.push(`read [${have}] but wanted [${want}]`);
  for (const e of expect) {
    const row = got.rows[e.cite];
    if (!row) continue;
    if (e.verdict !== "any" && row.verdict !== e.verdict) out.push(`${e.cite}: ${row.verdict}, wanted ${e.verdict}`);
    if (e.count && row.count !== e.count) out.push(`${e.cite}: counted ${row.count}, wanted ${e.count}`);
    if (e.also && JSON.stringify(row.also) !== JSON.stringify(e.also)) out.push(`${e.cite}: also ${JSON.stringify(row.also)}, wanted ${JSON.stringify(e.also)}`);
  }
  return out;
}

const byFamily = {};
for (const f of key.filings) {
  const text = fs.readFileSync(new URL(`scenarios/${f.id}.txt`, dir), "utf8");
  const t0 = performance.now();
  let got, crashed = null;
  try { got = run(text); } catch (e) { crashed = String(e && e.message); }
  const ms = performance.now() - t0;
  const bad = crashed ? [`crashed: ${crashed}`] : problems(f.expect, got);
  (byFamily[f.family] ||= []).push({ id: f.id, note: f.note, bad, ms });
}

for (const [family, list] of Object.entries(byFamily)) {
  test(`scenario family "${family}": ${list.length} filings, each read exactly as the answer key says`, () => {
    const wrong = list.filter((x) => x.bad.length);
    console.log(`eval scenarios (${family}): ${list.length - wrong.length}/${list.length} right`);
    assert.deepEqual(wrong.map((x) => `${x.id}${x.note ? " (" + x.note + ")" : ""}: ${x.bad.join("; ")}`), []);
  });
}

test("no scenario filing is slow to read: the slowest takes under a second", () => {
  const slowest = Math.max(...Object.values(byFamily).flat().map((x) => x.ms));
  console.log(`eval scenarios: slowest filing ${slowest.toFixed(0)} ms`);
  assert.ok(slowest < 1000, slowest + " ms");
});

test("PDF layouts: columns, headers, a citation split across pages, a sideways page, tiny and huge type, blank pages and long files", async () => {
  const wrong = [];
  for (const p of key.pdfs) {
    const data = new Uint8Array(fs.readFileSync(new URL(p.file, dir)));
    const { text, pages, pagesRead } = await extractPdfText(lib, data);
    const bad = problems(p.expect, run(text));
    if (p.id === "forty-five-pages") { if (pages !== 45 || pagesRead !== 40) bad.push(`read ${pagesRead} of ${pages} pages, wanted 40 of 45`); }
    if (p.id === "blank" && text.replace(/\s/g, "").length) bad.push("a blank page had text");
    if (bad.length) wrong.push(`${p.id} (${p.note}): ${bad.join("; ")}`);
  }
  console.log(`eval scenarios (PDFs): ${key.pdfs.length - wrong.length}/${key.pdfs.length} right`);
  assert.deepEqual(wrong, []);
});
