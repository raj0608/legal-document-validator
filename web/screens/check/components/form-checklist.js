// ---------- Form checklist (no AI) ----------
import { $, el } from "/web/shared/lib/dom.js";
import { t } from "/web/shared/lib/page-text.js";
import { state } from "/web/shared/state.js";
import { formType, checkForm } from "/shared/analysis/form-checklist.js";
import { fromISO, dayDiff } from "/shared/dates/date-math.js";

export function renderChecks() {
  const d = state.form;
  $("formOut").hidden = !d;
  if (!d) return;
  $("formType").textContent = t("form_type", { x: t(formType(d.raw)) });
  const ul = $("checks");
  ul.textContent = "";
  const hearing = fromISO(state.dates.hearing);
  checkForm(d.raw, { hearingDays: hearing ? dayDiff(hearing) : null }).forEach((c) => {
    const li = el("li");
    const head = el("div");
    head.appendChild(el("span", "lbl", t(c.lbl)));
    const stKey = { ok: "st_ok", miss: "st_miss", unclear: "st_unclear", info: "st_info" }[c.st];
    head.appendChild(el("span", "st " + (c.st === "info" ? "unclear" : c.st), t(stKey)));
    li.appendChild(head);
    li.appendChild(el("span", "ctx", t(c.detailKey, c.vars)));
    if (c.snips && c.snips.length) {
      const sn = el("ul", "snips");
      c.snips.forEach((s) => sn.appendChild(el("li", null, s)));
      li.appendChild(sn);
    }
    if (c.src) { const a = el("a", null, c.src.label); a.href = c.src.url; a.target = "_blank"; a.rel = "noopener"; li.appendChild(a); }
    ul.appendChild(li);
  });
}
