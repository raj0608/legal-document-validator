// The citation report: a summary, then one line for each case citation, the clearest signs first.
import { $, el } from "/app/shared/lib/dom.js";
import { t } from "/app/shared/lib/page-text.js";
import { state } from "/app/shared/state.js";
import { buildReport } from "/shared/analysis/citation-report.js";

const CHIP = (v) => (v === "found" ? "ok" : v === "unchecked" ? "none" : "look");

// Only courtlistener.com addresses become links, whatever the server sent.
function safeUrl(u) {
  try { const x = new URL(u); return x.protocol === "https:" && x.hostname === "www.courtlistener.com" ? x.href : null; } catch (e) { return null; }
}

function describe(row) {
  const f = row.found;
  if (row.verdict === "found") return t("cite_d_found", { db: f.name + (f.year ? " (" + f.year + ")" : "") });
  if (row.verdict === "name_differs") return t("cite_d_name_differs", { filed: row.name, db: f.name });
  if (row.verdict === "year_differs") return t("cite_d_year_differs", { y1: row.year, y2: f.year });
  return t("cite_d_" + row.verdict);
}

function drawRow(row) {
  const li = el("li", "cite-row");
  const head = el("div", "cite-head");
  head.append(el("strong", "cite-num", row.cite), el("span", "cite-chip " + CHIP(row.verdict), t("cite_v_" + row.verdict)));
  li.appendChild(head);
  if (row.name) li.appendChild(el("p", "cite-line", t("cite_in_filing", { name: row.name + (row.year ? " (" + row.year + ")" : "") })));
  li.appendChild(el("p", "cite-line", describe(row)));
  if (row.count > 1) li.appendChild(el("p", "cite-line ctx", t("cite_times", { n: row.count })));
  if (row.also.length) li.appendChild(el("p", "cite-line ctx", t("cite_also", { c: row.also.join("; ") })));
  const url = row.found && safeUrl(row.found.url);
  if (url) {
    const a = el("a", null, t("court_open"));
    a.href = url; a.target = "_blank"; a.rel = "noopener";
    li.appendChild(a);
  }
  return li;
}

function drawSummary(box, cites, counts, rep) {
  box.textContent = "";
  box.appendChild(el("h3", null, cites.length ? t("court_sum_h", { n: cites.length }) : t("court_none")));
  if (!cites.length) { box.appendChild(el("p", null, t("court_none_note"))); return; }
  const ul = el("ul");
  ul.append(el("li", null, t("court_sum_found", { n: counts.found })), el("li", null, t("court_sum_check", { n: counts.check })));
  if (counts.unchecked) ul.appendChild(el("li", null, t("court_sum_unchecked", { n: counts.unchecked })));
  box.appendChild(ul);
  if (rep.capped) box.appendChild(el("p", null, t("court_cap", { n: cites.length })));
  if (rep.error) box.appendChild(el("p", "warn", rep.error));
}

function drawRefs(box, refs) {
  box.textContent = "";
  if (!refs.length) return;
  box.appendChild(el("h3", null, t("court_refs_h")));
  box.appendChild(el("p", "small", t("court_refs_p")));
  const ul = el("ul");
  for (const r of refs) {
    const li = el("li");
    const a = el("a", null, r.label);
    a.href = r.url; a.target = "_blank"; a.rel = "noopener";
    li.appendChild(a);
    ul.appendChild(li);
  }
  box.appendChild(ul);
}

// Draws state.filingReport = { cites, refs, results, error, capped }, or hides the report when there is none.
export function renderReport() {
  const rep = state.filingReport;
  $("citeReport").hidden = !rep;
  if (!rep) return;
  const { rows, counts } = buildReport(rep.cites, rep.results);
  drawSummary($("citeSummary"), rep.cites, counts, rep);
  const list = $("citeRows");
  list.textContent = "";
  rows.forEach((r) => list.appendChild(drawRow(r)));
  drawRefs($("citeRefs"), rep.refs);
  $("citePrint").hidden = !rep.cites.length && !rep.refs.length;
}
