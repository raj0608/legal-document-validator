// The Clear everything button, and the Yes or Cancel step before anything is cleared.
import { $ } from "/web/shared/lib/dom.js";
import { t } from "/web/shared/lib/page-text.js";
import { toast } from "/web/shared/ui/toast.js";

const closeConfirm = () => { $("clearConfirm").hidden = true; $("clearAll").hidden = false; };

export function initClearEverything(clearAll) {
  $("clearAll").addEventListener("click", () => { $("clearAll").hidden = true; $("clearConfirm").hidden = false; $("clearNo").focus(); });
  $("clearNo").addEventListener("click", () => { closeConfirm(); $("clearAll").focus(); });
  $("clearYes").addEventListener("click", () => { clearAll(); closeConfirm(); toast(t("cleared")); });
}
