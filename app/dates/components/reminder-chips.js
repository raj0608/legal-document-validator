// The reminder choices, as chips that turn on and off.
import { el } from "/app/shared/lib/dom.js";
import { t } from "/app/shared/lib/page-text.js";
import { state } from "/app/shared/state.js";
import { REMS } from "/shared/dates/reminders.js";
import { renderDates } from "/app/dates/page.js";

// The reminder choices appear on My dates and, inside the four-step path, on step 3, so nobody has to leave the path to use them.
export function renderRemChips() {
  document.querySelectorAll(".rem-chips").forEach((box) => {
    box.textContent = "";
    REMS.forEach((r) => {
      const b = el("button", "chip", t(r.key));
      b.type = "button";
      b.setAttribute("aria-pressed", String(!!state.rems[r.k]));
      b.addEventListener("click", () => { state.rems[r.k] = !state.rems[r.k]; renderRemChips(); renderDates(); });
      box.appendChild(b);
    });
  });
}
