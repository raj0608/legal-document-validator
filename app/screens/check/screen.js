// "Check my form": the checklist for a filled-in form, and the reader for a clerk's notice.
import { $ } from "/app/shared/lib/dom.js";
import { state } from "/app/shared/state.js";
import { registerSlot } from "/app/shared/ui/document-slot.js";
import { renderDates } from "/app/screens/dates/screen.js";
import { renderChecks } from "/app/screens/check/components/form-checklist.js";
import { renderCure } from "/app/screens/check/components/fix-by-date.js";
import { blanks, clerkNotice } from "/app/screens/check/components/ai-cards.js";

export function registerCheckSlots() {
  registerSlot("form", {
    onLoad() { $("blanksOut").textContent = ""; renderChecks(); },
    onRemove() { $("formOut").hidden = true; $("blanksOut").textContent = ""; }
  });
  registerSlot("clerk", {
    onLoad() { $("clerkAi").textContent = ""; renderCure(); },
    onRemove() { $("clerkOut").hidden = true; $("clerkAi").textContent = ""; if (state.dates.cure) { state.dates.cure = ""; renderDates(); } }
  });
}

export function setMode(m) {
  $("modeForm").setAttribute("aria-pressed", String(m === "form"));
  $("modeClerk").setAttribute("aria-pressed", String(m === "clerk"));
  $("formPanel").hidden = m !== "form";
  $("clerkPanel").hidden = m !== "clerk";
}

export function initCheck() {
  $("blanksBtn").addEventListener("click", blanks);
  $("clerkBtn").addEventListener("click", clerkNotice);
  $("recheckBtn").addEventListener("click", () => { setMode("form"); window.scrollTo(0, 0); });
  $("modeForm").addEventListener("click", () => setMode("form"));
  $("modeClerk").addEventListener("click", () => setMode("clerk"));
}
