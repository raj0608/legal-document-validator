// Rental-aid statuses and amounts in the page's language, for 90-day pauses and the agency's page.
import { t, locale } from "/app/shared/lib/page-text.js";

export const aidName = (status) => ({
  applied: t("aid_applied"), documents: t("aid_documents"), approved: t("aid_approved"), paid: t("aid_paid"), denied: t("aid_denied")
})[status];

export function money(n) {
  try { return new Intl.NumberFormat(locale(), { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n); } catch (e) { return "$" + n; }
}

// "Approved: $1,850", or that there is no update yet.
export const aidSummary = (aid) => (aid ? aidName(aid.status) + (aid.amount ? ": " + money(aid.amount) : "") : t("aid_none"));
