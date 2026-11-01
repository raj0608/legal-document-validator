// ---------- Laws and cases ----------
import { SRC } from "../i18n/sources.js";

export function findCites(text) {
  const out = [], seen = new Set();
  const add = (kind, label, url) => { const k = label.toLowerCase().replace(/\s+/g, " "); if (!seen.has(k)) { seen.add(k); out.push({ kind, label, url }); } };
  let m;
  const reCode = /\b(?:IC|I\.C\.|Ind(?:iana|\.)?\s*Code)\s*(?:§+\s*)?(\d{1,2})-(\d{1,3})-(\d{1,3})(?:-(\d{1,3}(?:\.\d+)?))?/gi;
  while ((m = reCode.exec(text))) add("kind_code", m[0].trim(), "https://iga.in.gov/ic/2026/Title_" + m[1] + "/Article_" + m[2] + "/Chapter_" + m[3] + ".pdf");
  const reTR = /\b(?:Ind(?:iana|\.)?\s+)?(?:Trial\s+Rule|T\.\s?R\.)\s*(\d{1,3})(?:\.(\d))?((?:\([A-Za-z0-9]+\))*)/gi;
  while ((m = reTR.exec(text))) add("kind_trial", m[0].trim(), "https://rules.incourts.gov/Content/trial/rule" + (m[2] ? m[1] + "-" + m[2] : m[1]) + "/current.htm");
  const reSC = /\b(?:Small\s+Claims\s+Rule|S\.\s?C\.\s?R?\.?)\s*(\d{1,2})((?:\([A-Za-z0-9]+\))*)/gi;
  while ((m = reSC.exec(text))) add("kind_sc", m[0].trim(), SRC.scr.url);
  const reCase = /\b\d{1,4}\s+N\.E\.(?:\s?[23]d)?\s+\d{1,5}\b/g;
  while ((m = reCase.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 90), m.index);
    const nm = /([A-Z][\w.'’&-]*(?:\s+[A-Z][\w.'’&-]*)*\s+v\.\s+[A-Z][\w.'’&-]*(?:\s+[A-Za-z][\w.'’&-]*)*),?\s*$/.exec(before);
    add("kind_case", (nm ? nm[1] + ", " : "") + m[0], "https://www.courtlistener.com/?q=" + encodeURIComponent('"' + m[0] + '"'));
  }
  return out;
}
