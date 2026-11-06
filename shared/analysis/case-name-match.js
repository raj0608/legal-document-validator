// ---------- Do two case names mean the same case? ----------
// A filing writes "Goldberg v. Kelly" and a database says "Goldberg v. Kelly" or "Goldberg v. Kelly, 397 U.S. 254".
// Names are compared by their distinctive words. Words every case has ("State", "Indiana", "County", "Department", "Inc")
// are left out, so "Flowers v. State" and "Rutherford v. State" are different cases, not two that share a word.
// Two names are the same case when at least half the distinctive words of the shorter one are in the other, and at least two words
// (one, if the shorter name has only one): a long caption that happens to share one word, like "Indianapolis", is not a match. When there is
// nothing distinctive to compare (for example "In re Estate"), they are treated as the same: only a clear difference is reported.

const NOISE = new Set([
  "the", "of", "in", "re", "ex", "rel", "et", "al", "and", "for", "on", "an", "at", "to", "by", "de", "la", "us", "see", "also",
  "inc", "llc", "co", "corp", "company", "corporation", "ltd", "llp", "lp", "pc", "na"
]);
// Words that name a kind of party or kind of case, not which one.
const GENERIC = new Set([
  "state", "states", "indiana", "ind", "united", "america", "people", "commonwealth", "county", "city", "town", "township",
  "department", "dept", "board", "commission", "office", "bureau", "agency", "services", "service", "family", "children", "child",
  "matter", "marriage", "estate", "termination", "parent", "parental", "relationship", "guardianship", "adoption", "petition"
]);

function words(name) {
  return new Set(String(name || "").toLowerCase().replace(/[.'’]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !NOISE.has(w) && !GENERIC.has(w)));
}

export function sameCase(filed, found) {
  const a = words(filed), b = words(found);
  if (!a.size || !b.size) return true;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  const fewer = Math.min(a.size, b.size);
  return shared >= Math.min(2, fewer) && shared / fewer >= 0.5;
}
