// Filing check for court staff: reads the case citations in a filing and checks them against a public case-law database.
// The filing is read in the browser. Only the citation numbers go to our server, and from there to the database.
import { $ } from "/app/shared/lib/dom.js";
import { t } from "/app/shared/lib/page-text.js";
import { state } from "/app/shared/state.js";
import { registerSlot } from "/app/shared/ui/document-slot.js";
import { findCaseCitations } from "/shared/analysis/case-citations.js";
import { findCites } from "/shared/analysis/citations.js";
import { lookupCitations } from "/app/shared/api/client.js";
import { renderReport } from "/app/court/components/citation-report.js";

const MAX_CITES = 100; // the most the server looks up at a time
const LAW_KINDS = ["kind_code", "kind_trial", "kind_sc"]; // laws and rules are listed with links, not checked

// Redraws the report, for example in a new language.
export function renderCourt() { renderReport(); }

function clearReport() {
  state.filingReport = null;
  $("citeStatus").hidden = true;
  renderReport();
}

export function registerCourtSlot() {
  registerSlot("filing", {
    onLoad() { clearReport(); $("citeRun").hidden = false; },
    onRemove() { clearReport(); $("citeRun").hidden = true; }
  });
}

function say(msg) { $("citeStatus").textContent = msg || ""; $("citeStatus").hidden = !msg; }

// What went wrong, in words for staff. "unavailable" means no lookup is set up on this server.
function errorText(code) {
  if (code === "unavailable") return t("court_off");
  if (code === "rate_limited") return t("court_err_rate");
  return t("err_generic");
}

async function runCheck() {
  const d = state.filing;
  if (!d) return;
  const all = findCaseCitations(d.raw);
  const cites = all.slice(0, MAX_CITES);
  const refs = findCites(d.raw).filter((c) => LAW_KINDS.includes(c.kind));
  const rep = { cites, refs, results: null, error: "", capped: all.length > cites.length };
  state.filingReport = rep;
  if (cites.length) {
    $("citeBtn").disabled = true;
    say(t("court_running", { n: cites.length }));
    try { rep.results = await lookupCitations(cites.map((c) => ({ volume: c.volume, reporter: c.reporter, page: c.page }))); }
    catch (e) { rep.error = errorText(e && e.code); }
    $("citeBtn").disabled = false;
    say("");
    if (state.filing !== d) return; // the filing was removed while the lookup ran
  }
  renderReport();
  $("citeReport").scrollIntoView({ block: "start" });
}

export function initCourt() {
  $("citeBtn").addEventListener("click", runCheck);
  $("citePrint").addEventListener("click", () => window.print());
}
