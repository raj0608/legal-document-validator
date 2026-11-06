// ---------- The court a filing says decided a case ----------
// A citation ends in (court and year): "(Ind. Ct. App. 2019)", "(7th Cir. 1994)". CourtListener names the court that really
// decided the case, with its own id ("indctapp", "ca7", "mass"). A made-up Indiana citation often lands on a real case from
// another state, so a different court is a sign worth showing. Only courts that can be read with confidence are compared;
// for anything else (most district courts, other states) the answer is "cannot tell", never "different".

const RULES = [
  [/\bInd\.?\s*Ct\.?\s*App/i, ["indctapp"]],
  [/\bInd\.?\s*App\b/i, ["indctapp"]],
  [/\bInd\.?\s*Tax\s*Ct/i, ["indtc"]],
  [/\bS\.?\s*D\.?\s*Ind\b/i, ["insd"]],
  [/\bN\.?\s*D\.?\s*Ind\b/i, ["innd"]],
  [/\bD\.?\s*C\.?\s*Cir/i, ["cadc"]],
  [/\bFed\.?\s*Cir/i, ["cafc"]],
  [/\b(\d{1,2})(?:st|nd|rd|th)\s*Cir/i, (m) => ["ca" + m[1]]],
  [/^\s*Ind\.?\s*(?:,|\d{4}|$)/i, ["ind"]]
];

// The CourtListener court ids a filing's parenthetical points to, or null when it cannot be read with confidence.
export function courtIdsFor(parenthetical) {
  const text = String(parenthetical || "").replace(/\b(1[89]\d\d|20\d\d)\b/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  for (const [re, ids] of RULES) {
    const m = re.exec(text);
    if (m) return typeof ids === "function" ? ids(m) : ids;
  }
  return null;
}

// Is the court the filing names the court CourtListener has? True whenever either side cannot be read.
export function sameCourt(parenthetical, courtId) {
  const ids = courtIdsFor(parenthetical);
  return !ids || !courtId || ids.includes(courtId);
}

// The court as the filing wrote it, without the year: "Ind. Ct. App."
export const courtText = (parenthetical) => String(parenthetical || "").replace(/\s*\b(1[89]\d\d|20\d\d)\b\s*/g, " ").replace(/\s+/g, " ").trim();
