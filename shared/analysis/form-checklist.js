// Reading a paper without any AI: the form checklist.
// Pure functions, no DOM. Text for the results comes from the UI strings (see detailKey/vars).
import { SRC } from "../i18n/sources.js";
import { ADDR_RE } from "../safety/redaction.js";

// ---------- Form checklist ----------
// Judged from the top of the paper. The back of a notice often mentions other kinds of requests
// (the Allen County eviction notice mentions continuances), which must not decide what the paper is.
export function formType(text) {
  const head = text.slice(0, 1500);
  if (/continu/i.test(head)) return "type_cont";
  if (/set\s+aside|vacate/i.test(head)) return "type_set";
  if (/\bseal/i.test(head)) return "type_seal";
  if (/counter-?claim/i.test(head)) return "type_counter";
  if (/appearance/i.test(head)) return "type_app";
  return "type_unknown";
}
function lineAfter(text, labelRe) {
  const m = labelRe.exec(text);
  if (!m) return null;
  const rest = text.slice(m.index + m[0].length).split("\n")[0];
  return rest.replace(/^[\s:]+/, "");
}
// A line like "Signature:   Date:" has no value after the first label: the rest is just the next label.
const filledValue = (v) => v !== null && /[A-Za-z0-9]/.test(v.replace(/_+/g, "").replace(/\b[A-Za-z][A-Za-z ().'\/-]{0,30}:/g, ""));

// Each result: { lbl, st: ok|miss|unclear|info, detailKey, vars, src, snips? }.
// hearingDays is how many days away the hearing in "My dates" is, or null if none is set.
export function checkForm(text, { hearingDays = null } = {}) {
  const res = [];
  const tail = text.slice(Math.floor(text.length * 0.5));
  const add = (lbl, st, src, extra) => res.push(Object.assign({ lbl, st, detailKey: lbl + "_d", vars: null, src: src || null }, extra));

  add("c_court", /(superior|circuit|small claims|county)\s+court/i.test(text) ? "ok" : "miss");
  const causeLine = lineAfter(text, /cause\s*(?:no\.?|number)/i);
  const hasCause = /\b\d{2}[A-Z]\d{2}-\d{4}-[A-Z]{2}-\d{1,6}\b/.test(text) || filledValue(causeLine);
  add("c_cause", hasCause ? "ok" : causeLine !== null ? "miss" : "unclear");
  add("c_parties", /plaintiff/i.test(text) && /defendant/i.test(text) ? "ok" : "unclear");
  add("c_title", /\b(motion|notice|appearance|petition|request|counterclaim)\b/i.test(text) ? "ok" : "unclear");

  // Blank lines (____) always count. An unchecked box counts too, unless it is one of a group of boxes
  // (boxes on neighbouring lines) where another box is checked: then the person has chosen, and the rest are not blanks.
  const blanks = [];
  const lines = text.split("\n");
  const boxLine = lines.map((l) => /^\s*(\[[ xX]\]|[☐☑☒□])/.test(l));
  const groupId = []; let g = -1, lastBox = -9;
  lines.forEach((l, i) => { if (boxLine[i]) { if (i - lastBox > 2) g++; groupId[i] = g; lastBox = i; } });
  const chosen = new Set();
  lines.forEach((l, i) => { if (boxLine[i] && /^\s*(\[[xX]\]|[☑☒])/.test(l)) chosen.add(groupId[i]); });
  lines.forEach((l, i) => {
    const hasBlank = /_{4,}/.test(l) || (/\[\s\]|☐|□/.test(l) && !(boxLine[i] && chosen.has(groupId[i])));
    const line = l.trim();
    if (hasBlank && !blanks.includes(line)) blanks.push(line);
  });
  add("c_blanks", blanks.length ? "miss" : "ok", null, {
    detailKey: blanks.length ? "c_blanks_d" : "c_blanks_ok", vars: blanks.length ? { n: blanks.length } : null, snips: blanks.slice(0, 8)
  });

  const sig = lineAfter(tail, /signature/i);
  add("c_sign", /\/s\/\s*\S/.test(text) ? "ok" : sig === null ? "unclear" : filledValue(sig) ? "ok" : "miss", SRC.tr11);
  const addrLine = lineAfter(tail, /(mailing\s+)?address/i);
  const phoneLine = lineAfter(tail, /phone|telephone/i);
  const hasAddr = new RegExp(ADDR_RE.source).test(tail) || filledValue(addrLine);
  const hasPhone = /(?:\(\s*\d{3}\s*\)\s*|\b\d{3}[-.\s])\d{3}[-.\s]\d{4}\b/.test(tail) || filledValue(phoneLine);
  add("c_contact", hasAddr && hasPhone ? "ok" : (addrLine !== null || phoneLine !== null) ? "miss" : "unclear", SRC.tr11);
  const dateLine = lineAfter(tail, /\bdate(?:d)?\b/i);
  add("c_date", dateLine === null ? "unclear" : filledValue(dateLine) ? "ok" : "miss");
  add("c_service", /certificate of service|i (?:hereby )?certify that[^.]{0,120}(served|mailed|delivered|sent)/i.test(text) ? "ok" : "miss", SRC.tr5);

  if (formType(text) === "type_cont" && hearingDays !== null) {
    add("c_timing", hearingDays > 7 ? "ok" : "miss", SRC.allen, { vars: { n: hearingDays } });
  }
  add("c_copies", "info", SRC.filing);
  add("c_ilh", "info", SRC.ilh);
  return res;
}
