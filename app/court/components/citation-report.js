// The citation report: a summary, then one line for each case citation, the clearest signs first.
import { $, el } from "/app/shared/lib/dom.js";
import { t } from "/app/shared/lib/page-text.js";
import { state } from "/app/shared/state.js";
import { buildReport } from "/shared/analysis/citation-report.js";
import { drawRows } from "/app/shared/ui/citation-rows.js";

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
  if (!rep) { $("citeSummary").textContent = ""; $("citeRows").textContent = ""; $("citeRefs").textContent = ""; return; } // hidden is not gone: "Hide this page" must leave nothing in the page
  const { rows, counts } = buildReport(rep.cites, rep.results);
  drawSummary($("citeSummary"), rep.cites, counts, rep);
  drawRows($("citeRows"), rows, "cite_");
  drawRefs($("citeRefs"), rep.refs);
  $("citePrint").hidden = !rep.cites.length && !rep.refs.length;
}
