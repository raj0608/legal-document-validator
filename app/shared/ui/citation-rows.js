// One line for each case citation in a report, for the staff page and for the tenant page. The page text comes from keys that start
// with `prefix` ("cite_" for staff, "mycite_" for tenants): <prefix>v_<verdict> is the label, <prefix>d_<verdict> the sentence, and
// <prefix>in_filing, <prefix>times, <prefix>also and <prefix>open for the rest.
import { el } from "/app/shared/lib/dom.js";
import { t } from "/app/shared/lib/page-text.js";
import { courtText } from "/shared/analysis/filing-court.js";

const CHIP = (v) => (v === "found" ? "ok" : v === "unchecked" ? "none" : "look");

// Only courtlistener.com addresses become links, whatever the server sent.
function safeUrl(u) {
  try { const x = new URL(u); return x.protocol === "https:" && x.hostname === "www.courtlistener.com" ? x.href : null; } catch (e) { return null; }
}

function describe(row, prefix) {
  const f = row.found;
  if (row.verdict === "found") return t(prefix + "d_found", { db: f.name + (f.year ? " (" + f.year + ")" : "") });
  if (row.verdict === "name_differs") return t(prefix + "d_name_differs", { filed: row.name, db: f.name });
  if (row.verdict === "court_differs") return t(prefix + "d_court_differs", { c1: courtText(row.court), c2: f.courtName || f.court });
  if (row.verdict === "year_differs") return t(prefix + "d_year_differs", { y1: row.year, y2: f.year });
  return t(prefix + "d_" + row.verdict);
}

function drawRow(row, prefix) {
  const li = el("li", "cite-row");
  const head = el("div", "cite-head");
  head.append(el("strong", "cite-num", row.cite), el("span", "cite-chip " + CHIP(row.verdict), t(prefix + "v_" + row.verdict)));
  li.appendChild(head);
  if (row.name) li.appendChild(el("p", "cite-line", t(prefix + "in_filing", { name: row.name + (row.year ? " (" + row.year + ")" : "") })));
  li.appendChild(el("p", "cite-line", describe(row, prefix)));
  if (row.count > 1) li.appendChild(el("p", "cite-line ctx", t(prefix + "times", { n: row.count })));
  if (row.also.length) li.appendChild(el("p", "cite-line ctx", t(prefix + "also", { c: row.also.join("; ") })));
  const url = row.found && safeUrl(row.found.url);
  if (url) {
    const a = el("a", null, t(prefix + "open"));
    a.href = url; a.target = "_blank"; a.rel = "noopener";
    li.appendChild(a);
  }
  return li;
}

export function drawRows(list, rows, prefix) {
  list.textContent = "";
  rows.forEach((r) => list.appendChild(drawRow(r, prefix)));
}
