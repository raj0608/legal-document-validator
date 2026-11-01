// ---------- Support contact ----------
import { el } from "/web/shared/lib/dom.js";
import { t } from "/web/shared/lib/page-text.js";

export const SUPPORT_PHONE = "+1000000000";
export function renderSupport() {
  document.querySelectorAll("[data-support]").forEach((e) => {
    e.textContent = "";
    const parts = t("support_line", { p: "\u0000" }).split("\u0000");
    e.append(parts[0] || "");
    const a = el("a", null, SUPPORT_PHONE);
    a.href = "tel:" + SUPPORT_PHONE;
    e.appendChild(a);
    e.append(parts[1] || "");
  });
}
