// ---------- Case citations ----------
// Finds case citations such as "Goldberg v. Kelly, 397 U.S. 254 (1970)", so a person can check that each one points at a real case.
// Laws and rules (IC 32-31-8-5, Trial Rule 12) are found by citations.js. This file is only for cases.

const REPORTERS = String.raw`U\.\s?S\.|S\.\s?Ct\.|L\.\s?Ed\.(?:\s?2d)?|F\.\s?Supp\.(?:\s?[23]d)?|F\.\s?App(?:'|’)x|F\.\s?(?:4th|3d|2d)|F\.|N\.\s?E\.(?:\s?[23]d)?|Ind\.\s?App\.|Ind\.`;

// How each reporter is written when it goes to the lookup, whatever spacing the filing used.
const CANON = {
  "U.S.": "U.S.", "S.Ct.": "S. Ct.", "L.Ed.": "L. Ed.", "L.Ed.2d": "L. Ed. 2d",
  "F.Supp.": "F. Supp.", "F.Supp.2d": "F. Supp. 2d", "F.Supp.3d": "F. Supp. 3d", "F.App'x": "F. App'x",
  "F.": "F.", "F.2d": "F.2d", "F.3d": "F.3d", "F.4th": "F.4th",
  "N.E.": "N.E.", "N.E.2d": "N.E.2d", "N.E.3d": "N.E.3d", "Ind.": "Ind.", "Ind.App.": "Ind. App."
};
const canonReporter = (raw) => { const k = raw.replace(/\s+/g, "").replace("’", "'"); return CANON[k] || raw.replace(/\s+/g, " "); };

// volume, reporter, first page, then an optional pinpoint page and an optional (court and year)
const CITE = new RegExp(String.raw`\b(\d{1,4})\s+(${REPORTERS})\s+(\d{1,5})(?:,\s*(\d{1,5})(?!\d|\s*[A-Z]))?(?:\s*\(([^()]{1,60})\))?`, "g");

// "Goldberg v. Kelly", read backwards from the citation. Also "In re A.K." and "In the Matter of ...", which have no "v.".
const WORD = String.raw`(?:[A-Z][\w'’&./\-]*|of|the|and|for|in|ex|rel\.|de|la|del|on|at|to|a|an|&|\d+)`;
const CAP = String.raw`[A-Z][\w'’&./\-]*`;
// the second party may be a list ("Eby v. York-Division, Borg-Warner")
const NAME = new RegExp(String.raw`(${WORD}(?:\s+${WORD})*?\s+v\.\s+${WORD}(?:\s+${WORD}|,\s+(?:and\s+)?${CAP})*)[\s,]*$`);
const IN_RE = new RegExp(String.raw`((?:In\s+re|In\s+the\s+Matter\s+of|Matter\s+of|Ex\s+parte)\s+${WORD}(?:\s+${WORD}){0,12})[\s,]*$`, "i");
const LEAD = /^(?:(?:see|also|cf|accord|but|contra|e\.g|in|the)\.?,?\s+)+/i;
// "Info. Servs., LLC" is one name: the comma before a company ending is not the end of it.
const COMPANY_COMMA = /,\s+(?=(?:Inc|LLC|L\.L\.C|Ltd|Co|Corp|LLP|LP|P\.C|N\.A|Jr|Sr|II|III)\b)/gi;

function nameBefore(text, index) {
  const before = text.slice(Math.max(0, index - 260), index).replace(COMPANY_COMMA, " ");
  const v = NAME.exec(before), re = v ? null : IN_RE.exec(before);
  const name = v ? v[1].replace(LEAD, "").trim() : re ? re[1].trim() : "";
  return name && name.length <= 200 ? name : null;
}

const yearOf = (s) => { const m = /\b(1[89]\d\d|20\d\d)\b/.exec(s || ""); return m ? Number(m[1]) : null; };

// One entry for each distinct citation, in the order they first appear. A string of cites to the same case
// ("397 U.S. 254, 90 S. Ct. 1011 (1970)") is one entry: it is checked by its first citation.
export function findCaseCitations(text) {
  const groups = [];
  let last = null, lastEnd = 0, m;
  CITE.lastIndex = 0;
  while ((m = CITE.exec(text))) {
    const cite = { volume: m[1], reporter: canonReporter(m[2]), page: m[3], paren: m[5] || "" };
    cite.text = cite.volume + " " + cite.reporter + " " + cite.page;
    if (last && /^\s*,\s*$/.test(text.slice(lastEnd, m.index))) {
      last.also.push(cite.text);
      if (cite.paren) last.paren = cite.paren;
    } else {
      last = { ...cite, name: nameBefore(text, m.index), index: m.index, also: [] };
      groups.push(last);
    }
    lastEnd = m.index + m[0].length;
  }
  const out = [], seen = new Map();
  for (const g of groups) {
    const key = [g.volume, g.reporter, g.page].join("|");
    if (seen.has(key)) { seen.get(key).count++; continue; }
    const entry = { cite: g.text, volume: g.volume, reporter: g.reporter, page: g.page, name: g.name, year: yearOf(g.paren), court: g.paren, also: g.also, index: g.index, count: 1 };
    seen.set(key, entry);
    out.push(entry);
  }
  return out;
}
