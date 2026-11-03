// ---------- Do two case names mean the same case? ----------
// A filing writes "Goldberg v. Kelly" and a database says "Goldberg v. Kelly" or "Goldberg v. Kelly, 397 U.S. 254".
// Names are compared by their distinctive words, side by side. Only a clear difference is reported: when there is
// nothing distinctive to compare (for example "In re Estate"), the names are treated as the same.

const NOISE = new Set(["the", "of", "in", "re", "ex", "rel", "et", "al", "and", "for", "on", "inc", "llc", "co", "corp", "company", "ltd", "see", "also"]);

function words(side) {
  return side.toLowerCase().replace(/[.'’]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !NOISE.has(w));
}

// "Goldberg v. Kelly" becomes [["goldberg"], ["kelly"]]
const sides = (name) => String(name || "").split(/\s+v(?:s)?\.?\s+/i).map(words);

export function sameCase(filed, found) {
  const a = sides(filed), b = sides(found);
  const anyWord = (s) => new Set(s.flat());
  if (!anyWord(a).size || !anyWord(b).size) return true;
  if (a.length < 2 || b.length < 2) return [...anyWord(a)].some((w) => anyWord(b).has(w));
  return [0, 1].some((i) => a[i].some((w) => b[i].includes(w)));
}
