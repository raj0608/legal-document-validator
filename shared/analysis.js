// Reading a paper without any AI: dates, citations, the form checklist and the clerk's fix-by date.
// Pure functions, no DOM. Text for the results comes from the UI strings (see detailKey/vars).
import { SRC, FAQ } from "./i18n.js";
import { ADDR_RE } from "./safety.js";
import { pad, toISO, addDays, addBusinessDays } from "./dates.js";
import { holidaysBetween } from "./holidays.js";

// ---------- Dates ----------
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
export function findDates(text) {
  const found = new Map();
  const reWord = /\b(?:(?:mon|tues|wednes|thurs|fri|satur|sun)day,?\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})/gi;
  const reNum = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
  const push = (d, idx, len) => {
    if (isNaN(d)) return;
    const key = toISO(d);
    if (found.has(key)) return;
    const cs = Math.max(0, idx - 70);
    const ctx = text.slice(cs, idx + len + 50).replace(/\s+/g, " ").trim();
    const after = text.slice(idx + len, idx + len + 100);
    const tm = /(\d{1,2}):(\d{2})\s*([ap])\.?\s*m\.?/i.exec(after.slice(0, 40));
    let time = "";
    if (tm) { let h = parseInt(tm[1], 10) % 12; if (tm[3].toLowerCase() === "p") h += 12; time = pad(h) + ":" + tm[2]; }
    const room = /(Room\s+[\w-]+(?:,\s*[^.\n]{0,60})?)/i.exec(after);
    const hearingLike = /appear|hearing|conference|trial|court date/i.test(text.slice(Math.max(0, idx - 120), idx));
    found.set(key, { date: d, ctx: (cs > 0 ? "…" : "") + ctx + "…", time, place: room ? room[1].replace(/\s+/g, " ").trim() : "", hearingLike });
  };
  let m;
  while ((m = reWord.exec(text))) push(new Date(+m[3], MONTHS.indexOf(m[1].toLowerCase()), +m[2]), m.index, m[0].length);
  while ((m = reNum.exec(text))) push(new Date(+m[3], +m[1] - 1, +m[2]), m.index, m[0].length);
  return Array.from(found.values()).sort((a, b) => a.date - b.date);
}

// ---------- Laws and cases ----------
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

// ---------- Clerk notice: fix-by date ----------
const WORDNUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fourteen: 14, fifteen: 15, thirty: 30, seventy: 70, "seventy-two": 72 };
export function findDeadline(text) {
  const re = /(?:within|in)\s+(?:([a-z-]+)\s+)?\(?(\d{1,3})?\)?\s*(business|court|calendar)?\s*(days?|hours?)/i;
  const m = re.exec(text);
  let n = null, unit = null, kind = "", quote = "";
  if (m) {
    n = m[2] ? +m[2] : (m[1] && WORDNUM[m[1].toLowerCase()]) || null;
    unit = m[4].toLowerCase().startsWith("hour") ? "hours" : "days";
    kind = (m[3] || "").toLowerCase();
    const s = text.lastIndexOf(".", m.index) + 1;
    const e = text.indexOf(".", m.index + m[0].length);
    quote = text.slice(s, e === -1 ? undefined : e + 1).replace(/\s+/g, " ").trim();
  } else {
    const h = /(\d{1,3})\s*-?\s*hours?/i.exec(text);
    if (h) { n = +h[1]; unit = "hours"; const s = text.lastIndexOf(".", h.index) + 1; const e = text.indexOf(".", h.index); quote = text.slice(s, e === -1 ? undefined : e + 1).replace(/\s+/g, " ").trim(); }
  }
  if (!n) return null;
  const dateLabel = /\bdate\s*:\s*/i.exec(text);
  let base = null;
  const dates = findDates(text);
  if (dateLabel) { const after = findDates(text.slice(dateLabel.index, dateLabel.index + 60)); if (after.length) base = after[0].date; }
  if (!base && dates.length) base = dates[0].date;
  if (!base) return { n, unit, kind, quote, date: null };
  let date;
  if (unit === "hours") date = addDays(base, Math.ceil(n / 24));
  else if (kind === "business" || kind === "court") date = addBusinessDays(base, n);
  else date = addDays(base, n);
  // `skipped`: the court holidays that were left out of a business-day count
  const skipped = (kind === "business" || kind === "court") && unit !== "hours" ? holidaysBetween(addDays(base, 1), date) : [];
  return { n, unit, kind, quote, date, base, skipped };
}

// Dates an answer may mention: the ones written in the paper, and the ones in our own FAQ sources (such as July 1, 2025).
const FAQ_DATES = FAQ.flatMap((f) => findDates(f.a.en).map((d) => toISO(d.date)));
export function allowedDates(paperText) {
  return new Set([...(paperText ? findDates(paperText).map((d) => toISO(d.date)) : []), ...FAQ_DATES]);
}
