// ---------- Draft docket entries and sealing orders ----------
// Text for the clerk to check, edit and paste into Odyssey. Nothing here is ever filed by this tool.
// Written in English, the language of the court record, whatever language the page is in. Fixed templates, not an AI:
// a court record says only what happened. The agency's free-text note never goes into a draft.
import { fromISO, toISO } from "../dates/date-math.js";
import { scheduleFor } from "./pause-schedule.js";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ORDER = "Indiana Supreme Court Order 22S-MS-308";
const PROGRAM = "the Pre-Eviction Diversion Program";

export const longDate = (iso) => { const d = fromISO(iso); return d ? MONTHS[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear() : ""; };
const dayOf = (ms) => toISO(new Date(ms));
const money = (n) => "$" + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const OUTCOME_LINE = {
  agreement: "The parties report an agreement. Agreed entry to be filed.",
  dismissed: "Case dismissed.",
  judgment: "Judgment for Plaintiff.",
  default: "Judgment by default for Plaintiff.",
  continued: "Hearing continued. New date to be set."
};

// The entry for one case on hearing day, from what the board recorded.
export function hearingEntry(c, dayISO) {
  const lines = [longDate(dayISO) + ". Case called."];
  lines.push("Plaintiff " + c.landlord + (c.landlordHere ? " appears" + (c.byCounsel ? " by counsel." : " in person.") : " does not appear."));
  lines.push("Defendant " + c.tenant + (c.tenantHere ? " appears in person." : " does not appear."));
  if (c.advised) lines.push("Pre-eviction diversion advisement given.");
  if (c.outcome === "diversion") {
    const s = scheduleFor(dayISO);
    lines.push("Both parties agree to participate in " + PROGRAM + ". Proceedings are stayed for ninety days under " + ORDER + ", through " + longDate(s.ends) + ".");
    lines.push("Status conferences set for " + longDate(s.day30) + " and " + longDate(s.day60) + ". Court records related to this eviction are confidential.");
  } else if (c.outcome) lines.push(OUTCOME_LINE[c.outcome]);
  return lines.join("\n");
}

function aidLine(p) {
  const a = p.aid;
  if (!a) return "No rental-assistance update received.";
  const who = a.by || "the rental-assistance provider", on = " (" + longDate(dayOf(a.at)) + ").";
  if (a.status === "applied") return "Rental assistance: application received by " + who + on;
  if (a.status === "documents") return "Rental assistance: " + who + " asked for documents" + on;
  if (a.status === "approved") return "Rental assistance: approved by " + who + ", " + money(a.amount) + on;
  if (a.status === "paid") return "Rental assistance: " + who + " paid " + money(a.amount) + " to Plaintiff" + on;
  return "Rental assistance: denied by " + who + on;
}

// The entry for a step in a paused case: a conference (or a report in its place), a resolution, or a lifted stay.
export function pauseEntry(kind, p, dayISO) {
  const head = longDate(dayISO) + ".";
  if (kind === "day30" || kind === "day60") {
    const label = kind === "day30" ? "30-day" : "60-day";
    const how = p[kind] && p[kind].how === "report"
      ? "Written status report filed in place of the " + label + " status conference."
      : "Status conference held (" + label + ").";
    return [head + " " + how, "The parties continue in " + PROGRAM + ".", aidLine(p), "The stay remains in effect through " + longDate(scheduleFor(p.start).ends) + "."].join("\n");
  }
  if (kind === "dismissed") return [head + " The parties resolved their dispute through " + PROGRAM + ".", "Case dismissed."].join("\n");
  if (kind === "agreement") return [head + " The parties resolved their dispute through " + PROGRAM + ".", "Diversion agreement filed. The court records remain confidential."].join("\n");
  if (kind === "lifted") {
    return [head + " The Court finds that a party is no longer actively following the case management order or participating in " + PROGRAM + " in good faith, and that in the interest of justice the case should proceed.",
      "The stay is lifted, and the court records are no longer confidential. Hearing to be set."].join("\n");
  }
  return "";
}

// A sealing order for a dismissed eviction case, for the judge to review and sign.
export function sealingOrder(c, dismissedISO, dayISO) {
  return [
    "ORDER TO SEAL EVICTION RECORD",
    "",
    "Cause No. " + c.cause,
    c.landlord + ", Plaintiff,",
    "v.",
    c.tenant + ", Defendant.",
    "",
    "This eviction action was dismissed on " + longDate(dismissedISO) + ". Under Indiana Code 32-31-11-3, the Court, on its own motion, orders the Clerk and the operator of any state, regional, or local case management system not to disclose or permit disclosure of any records in this case, and directs the Clerk to redact or permanently seal the Court's own records related to this eviction action.",
    "",
    "SO ORDERED on " + longDate(dayISO) + ".",
    "",
    "______________________________",
    "Judge"
  ].join("\n");
}
