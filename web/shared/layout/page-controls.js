// The header's Bigger text and Hide this page buttons, and Start over on the cover.
import { $ } from "/web/shared/lib/dom.js";
import { t } from "/web/shared/lib/page-text.js";

export function renderSize() {
  const big = document.documentElement.classList.contains("big");
  $("sizeIcon").textContent = big ? "A−" : "A+";
  $("sizeLabel").textContent = big ? t("size_down") : t("size_up");
}

export function initPageControls(clearAll) {
  $("hide").addEventListener("click", () => { clearAll(); $("cover").hidden = false; $("startOver").focus(); });
  $("startOver").addEventListener("click", () => { $("cover").hidden = true; location.hash = "#home"; });
  $("size").addEventListener("click", () => {
    document.documentElement.classList.toggle("big", !document.documentElement.classList.contains("big"));
    renderSize();
  });
}
