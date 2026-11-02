// A short message at the bottom of the screen that goes away by itself.
import { $ } from "/app/shared/lib/dom.js";

let toastTimer;
export function toast(msg) {
  const e = $("toast");
  e.textContent = msg;
  e.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => e.classList.remove("show"), 3200);
}
