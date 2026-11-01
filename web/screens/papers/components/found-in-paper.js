// ---------- Dates and laws found in the paper (no AI) ----------
import { $, el } from "/web/shared/lib/dom.js";
import { t } from "/web/shared/lib/page-text.js";
import { state } from "/web/shared/state.js";
import { fmtDate, fmtTime } from "/web/shared/lib/date-format.js";
import { toast } from "/web/shared/ui/toast.js";
import { findDates } from "/shared/analysis/paper-dates.js";
import { findCites } from "/shared/analysis/citations.js";
import { toISO, dayDiff } from "/shared/dates/date-math.js";
import { renderDates } from "/web/screens/dates/screen.js";

export function autoDatesFromPapers() {
  const d = state.papers;
  if (!d) return;
  const hearings = findDates(d.raw).filter((x) => x.hearingLike);
  if (hearings.length === 1 && dayDiff(hearings[0].date) >= -1) {
    const h = hearings[0];
    state.dates.hearing = toISO(h.date);
    state.dates.time = h.time || state.dates.time;
    if (h.place) state.dates.place = h.place;
    state.dates.fromPaper = true;
    renderDates();
    toast(t("auto_added"));
  }
}

export function renderFound() {
  const d = state.papers;
  if (!d) return;
  const ul = $("foundDates");
  ul.textContent = "";
  const dates = findDates(d.raw);
  if (!dates.length) ul.appendChild(el("li", null, t("dates_none")));
  dates.forEach((x) => {
    const li = el("li");
    li.append(el("mark", null, fmtDate(x.date) + (x.time ? " " + t("at_time", { t: fmtTime(x.time) }) : "")), el("span", "ctx", x.ctx));
    if (x.hearingLike || dates.length === 1) {
      const b = el("button", "link-btn", t("use_hearing")); b.type = "button";
      b.addEventListener("click", () => {
        state.dates.hearing = toISO(x.date);
        if (x.time) state.dates.time = x.time;
        if (x.place) state.dates.place = x.place;
        state.dates.fromPaper = true;
        renderDates();
        toast(t("added"));
      });
      li.appendChild(b);
    }
    ul.appendChild(li);
  });
  const cl = $("foundCites");
  cl.textContent = "";
  const cites = findCites(d.raw);
  if (!cites.length) cl.appendChild(el("li", null, t("cites_none")));
  cites.forEach((c) => {
    const li = el("li");
    const a = el("a", null, c.kind === "kind_case" ? t("search_case") : t("open_source"));
    a.href = c.url; a.target = "_blank"; a.rel = "noopener";
    li.append(el("span", "cite-text", c.label), el("span", "badge", t("not_checked")), el("span", "ctx", t(c.kind)), a);
    cl.appendChild(li);
  });
}
