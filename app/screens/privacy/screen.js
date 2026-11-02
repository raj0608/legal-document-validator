// The Privacy screen: how papers are handled now, what a real launch would need, and extra names to hide.
import { $, el } from "/app/shared/lib/dom.js";
import { t } from "/app/shared/lib/page-text.js";
import { reprotectAll } from "/app/shared/ui/document-slot.js";

export function renderPrivacy() {
  const fill = (id, arr) => { const ul = $(id); ul.textContent = ""; arr.forEach((x) => ul.appendChild(el("li", null, x))); };
  fill("privNow", t("privacy_now"));
  fill("privLaunch", t("privacy_launch"));
}

export function initPrivacy() {
  $("extraNames").addEventListener("change", reprotectAll);
}
