// "Cases I name": the tenant's own filing, with each court case it names looked up in a public case-law database.
// The filing is read in the browser and kept only in memory. Only the case numbers go to our server, and from there to the database.
import { $, el } from "/app/shared/lib/dom.js";
import { t } from "/app/shared/lib/page-text.js";
import { state } from "/app/shared/state.js";
import { findCaseCitations } from "/shared/analysis/case-citations.js";
import { buildReport } from "/shared/analysis/citation-report.js";
import { lookupCitations } from "/app/shared/api/client.js";
import { drawRows } from "/app/shared/ui/citation-rows.js";

const MAX_CITES = 100; // the most the server looks up at a time

export function clearCites() {
  state.citesReport = null;
  $("citesStatus").hidden = true;
  renderCites();
}

export function showCitesRun(on) { $("citesRun").hidden = !on; }

function drawSummary(box, rep, counts) {
  box.textContent = "";
  box.appendChild(el("h3", null, rep.cites.length ? t("cites_sum_h", { n: rep.cites.length }) : t("cites_none")));
  if (!rep.cites.length) { box.appendChild(el("p", null, t("cites_none_note"))); return; }
  const ul = el("ul");
  ul.append(el("li", null, t("cites_sum_found", { n: counts.found })), el("li", null, t("cites_sum_check", { n: counts.check })));
  if (counts.unchecked) ul.appendChild(el("li", null, t("cites_sum_unchecked", { n: counts.unchecked })));
  box.appendChild(ul);
  if (rep.capped) box.appendChild(el("p", null, t("cites_cap", { n: rep.cites.length })));
  if (rep.error) box.appendChild(el("p", "warn", rep.error));
}

// Draws state.citesReport = { cites, results, error, capped }, or hides the report when there is none.
export function renderCites() {
  const rep = state.citesReport;
  $("citesReport").hidden = !rep;
  if (!rep) { $("citesSummary").textContent = ""; $("citesRows").textContent = ""; return; } // hidden is not gone: "Hide this page" must leave nothing in the page
  const { rows, counts } = buildReport(rep.cites, rep.results);
  drawSummary($("citesSummary"), rep, counts);
  drawRows($("citesRows"), rows, "mycite_");
}

function errorText(code) {
  if (code === "unavailable") return t("cites_off");
  if (code === "rate_limited") return t("cites_err_rate");
  return t("err_generic");
}

export async function runCites() {
  const d = state.cites;
  if (!d) return;
  const all = findCaseCitations(d.raw);
  const cites = all.slice(0, MAX_CITES);
  const rep = { cites, results: null, error: "", capped: all.length > cites.length };
  state.citesReport = rep;
  if (cites.length) {
    $("citesBtn").disabled = true;
    $("citesStatus").textContent = t("cites_running", { n: cites.length });
    $("citesStatus").hidden = false;
    try { rep.results = await lookupCitations(cites.map((c) => ({ volume: c.volume, reporter: c.reporter, page: c.page }))); }
    catch (e) { rep.error = errorText(e && e.code); }
    $("citesBtn").disabled = false;
    $("citesStatus").hidden = true;
    if (state.cites !== d) return; // the filing was removed while the lookup ran
  }
  renderCites();
  $("citesReport").scrollIntoView({ block: "start" });
}
