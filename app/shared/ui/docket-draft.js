// A drafted docket entry or order for the clerk: the text in a box they can edit, and a row of buttons under it.
// The text is in English, the language of the court record (see /shared/court/docket-drafts.js).
import { el } from "/app/shared/lib/dom.js";
import { t } from "/app/shared/lib/page-text.js";
import { toast } from "/app/shared/ui/toast.js";

// Copies the box's text as it is now, with the clerk's edits. Where the browser will not copy, the text is selected instead.
export function copyButton(ta) {
  const copy = el("button", "btn primary", t("draft_copy"));
  copy.type = "button";
  copy.dataset.key = "draft-copy";
  copy.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(ta.value); toast(t("draft_copied")); }
    catch (e) { ta.focus(); ta.select(); toast(t("draft_copy_by_hand")); }
  });
  return copy;
}

// cause: shown above the text when the dialog does not already say which case it is.
// extra: buttons beside Copy; copy: false leaves Copy out (until a step is recorded).
export function draftBox(text, { cause = "", extra = [], copy = true } = {}) {
  const box = el("div", "draft");
  if (cause) box.appendChild(el("p", "draft-case", t("draft_case", { c: cause })));
  box.appendChild(el("p", "small", t("draft_note")));
  const ta = el("textarea");
  ta.value = text;
  ta.rows = Math.min(16, text.split("\n").length + 3);
  ta.spellcheck = false;
  ta.setAttribute("aria-label", t("draft_label"));
  const row = el("div", "dlg-row draft-row");
  if (copy) row.appendChild(copyButton(ta));
  row.append(...extra);
  box.append(ta, row);
  return box;
}
