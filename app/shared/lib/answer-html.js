// ---------- Text rendering (everything is escaped before any HTML is built) ----------
import { unredact } from "/shared/safety/redaction.js";
import { markDates } from "/shared/answer-dates.js";

export function escapeHtml(s) { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function inline(s) { return s.replace(/==(.+?)==/g, "<mark>$1</mark>").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"); }
export function mdToHtml(text) {
  let html = "", list = "";
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line), ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      const type = ul ? "ul" : "ol";
      if (list !== type) { if (list) html += "</" + list + ">"; html += "<" + type + ">"; list = type; }
      html += "<li>" + inline(escapeHtml((ul || ol)[1])) + "</li>";
      continue;
    }
    if (list) { html += "</" + list + ">"; list = ""; }
    if (!line.trim()) continue;
    const h = /^#{1,6}\s+(.*)$/.exec(line);
    html += "<p>" + (h ? "<strong>" + inline(escapeHtml(h[1])) + "</strong>" : inline(escapeHtml(line))) + "</p>";
  }
  if (list) html += "</" + list + ">";
  return html;
}

// What the AI wrote, ready to show: private details put back, dates highlighted, everything escaped first.
export function answerHtml(text, back) { return mdToHtml(markDates(unredact(text, back))); }
// The same for a single line (the JSON answers), without paragraph tags.
export function inlineHtml(text, back) { return inline(escapeHtml(markDates(unredact(text, back)))); }
