// ---------- The citation report ----------
// Puts what a filing says next to what the case-law database found. This is a checking aid for a person, not a finding:
// "not found" means the database has no such case, which can also mean the database has a gap.
import { sameCase } from "./case-name-match.js";

// How the lookup answered, per citation: { status, clusters: [{ name, year, url }] }
//   status: found | ambiguous | not_found | unrecognised | limited
// `results` lines up with `cites`; a missing entry means the citation was not checked.

// The order a person should look in: the clearest signs first, what was found last.
export const VERDICTS = ["name_differs", "year_differs", "ambiguous", "not_found", "unknown_reporter", "unchecked", "found"];
export const needsLook = (v) => v !== "found" && v !== "unchecked";

function judge(c, r) {
  if (!r || r.status === "limited") return { verdict: "unchecked" };
  if (r.status === "unrecognised") return { verdict: "unknown_reporter" };
  const clusters = r.clusters || [];
  if (r.status === "not_found" || !clusters.length) return { verdict: "not_found" };
  if (r.status === "ambiguous" && !c.name) return { verdict: "ambiguous", found: clusters[0] };
  const named = c.name ? clusters.filter((k) => sameCase(c.name, k.name)) : clusters;
  if (!named.length) return { verdict: "name_differs", found: clusters[0] };
  const sameYear = c.year ? named.find((k) => !k.year || k.year === c.year) : named[0];
  if (!sameYear) return { verdict: "year_differs", found: named[0] };
  return { verdict: "found", found: sameYear };
}

export function buildReport(cites, results) {
  const rows = cites.map((c, i) => ({ cite: c.cite, name: c.name, year: c.year, count: c.count, also: c.also, index: i, ...judge(c, results && results[i]) }));
  const counts = { found: 0, check: 0, unchecked: 0 };
  for (const r of rows) counts[r.verdict === "found" ? "found" : r.verdict === "unchecked" ? "unchecked" : "check"]++;
  rows.sort((a, b) => VERDICTS.indexOf(a.verdict) - VERDICTS.indexOf(b.verdict) || a.index - b.index);
  return { rows, counts };
}
