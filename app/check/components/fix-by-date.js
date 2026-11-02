// ---------- Clerk notice: fix-by date (no AI) ----------
import { $, el } from "/app/shared/lib/dom.js";
import { t } from "/app/shared/lib/page-text.js";
import { state } from "/app/shared/state.js";
import { fmtDate } from "/app/shared/lib/date-format.js";
import { findDeadline } from "/shared/analysis/fix-by-date.js";
import { toISO } from "/shared/dates/date-math.js";
import { SRC } from "/shared/i18n/sources.js";
import { renderDates } from "/app/dates/page.js";

export function renderCure() {
  const d = state.clerk;
  $("clerkOut").hidden = !d;
  if (!d) return;
  const card = $("cureCard");
  card.textContent = "";
  const dl = findDeadline(d.raw);
  card.appendChild(el("div", "label", t("fixby")));
  if (dl && dl.date) {
    const big = el("div", "big");
    big.appendChild(el("mark", null, fmtDate(dl.date)));
    card.appendChild(big);
    if (dl.quote) card.appendChild(el("div", "sub", t("deadline_quote") + " “" + dl.quote + "”"));
    card.appendChild(el("p", "small", t("fixby_hol")));
    if (dl.skipped && dl.skipped.length) card.appendChild(el("p", "small", t("fixby_skipped", { x: dl.skipped.map((h) => fmtDate(h.date) + " (" + t("hol_" + h.id) + ")").join("; ") })));
    if (state.dates.cure !== toISO(dl.date)) { state.dates.cure = toISO(dl.date); renderDates(); }
  } else {
    card.appendChild(el("p", null, t("fixby_none")));
  }
  const note = el("p", "small", t("fixby_note") + " ");
  const a = el("a", null, SRC.tr88.label); a.href = SRC.tr88.url; a.target = "_blank"; a.rel = "noopener";
  note.appendChild(a);
  for (const k of ["tr6", "holidays"]) {
    const l = el("a", null, SRC[k].label); l.href = SRC[k].url; l.target = "_blank"; l.rel = "noopener";
    note.append("; ", l);
  }
  card.appendChild(note);
}
