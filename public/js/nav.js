// Moving around: which screen is showing, the four-step "My papers" path, and where keyboard focus goes.
// The addresses are plain links (see shared/nav.js), so the phone's Back button always works.
import { $, el, t, state } from "./core.js";
import { parseRoute, hashFor, guard, menuItemFor, VIEWS, PAPER_STEPS } from "/shared/nav.js";
import { setMode } from "./check-view.js";
import { renderNext } from "./home.js";

let current = { view: "home" };

export function renderSteps() {
  const box = $("paperSteps");
  box.textContent = "";
  const step = current.view === "papers" ? current.step : 1;
  box.appendChild(el("p", "count", t("step_of", { n: step, total: PAPER_STEPS })));
  const ol = el("ol");
  for (let n = 1; n <= PAPER_STEPS; n++) {
    const li = el("li");
    if (n < step) li.classList.add("done");
    if (n === step) li.setAttribute("aria-current", "step");
    const num = el("span", "num", n < step ? "✓" : String(n));
    const label = el("span", "label", t("st" + n));
    if (n !== step && (n === 1 || state.papers)) {
      const a = el("a");
      a.href = hashFor({ view: "papers", step: n });
      a.append(num, label);
      li.appendChild(a);
    } else li.append(num, label);
    ol.appendChild(li);
  }
  box.appendChild(ol);
}

// Step 1 can only continue once there is a paper.
export function refreshStepControls() {
  $("papersNext1").disabled = !state.papers;
  $("s1Ready").hidden = !state.papers;
  renderSteps();
}

// Redraw the parts of the navigation that carry words (after a language change, or when a date appears).
export function refreshNav() {
  // The title names the screen and, on My papers, the step, so a screen reader and the browser history say where the person is.
  const h = current.view === "papers"
    ? document.querySelector('#view-papers .step[data-step="' + current.step + '"] h2')
    : $("view-" + current.view).querySelector("h1");
  document.title = (h ? h.textContent + " – " : "") + t("brand");
  renderSteps();
  renderNext();
}

export function route({ initial = false } = {}) {
  let r = guard(parseRoute(location.hash), Boolean(state.papers));
  if (r.view === "papers" && parseRoute(location.hash).step !== r.step) history.replaceState(null, "", hashFor(r));
  const changedView = r.view !== current.view;
  current = r;
  document.body.dataset.view = r.view;
  VIEWS.forEach((v) => { $("view-" + v).hidden = v !== r.view; });
  document.querySelectorAll(".main-nav a").forEach((a) => {
    if (a.dataset.view === menuItemFor(r.view)) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  let heading = $("view-" + r.view).querySelector("h1");
  if (r.view === "papers") {
    document.querySelectorAll("#view-papers .step").forEach((s) => { s.hidden = +s.dataset.step !== r.step; });
    heading = document.querySelector('#view-papers .step[data-step="' + r.step + '"] h2');
  }
  if (r.view === "check") setMode(r.mode);
  refreshStepControls();
  refreshNav();
  if (!initial) {
    window.scrollTo(0, 0);
    // Move focus to the new heading so a screen reader says where the person is, and the keyboard starts at the top.
    if (heading) heading.focus({ preventScroll: true });
  }
  return changedView;
}

export function initNav() {
  window.addEventListener("hashchange", () => route());
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-step-go]");
    if (!b || b.disabled) return;
    const step = current.view === "papers" ? current.step : 1;
    const to = Math.min(PAPER_STEPS, Math.max(1, step + (b.dataset.stepGo === "next" ? 1 : -1)));
    location.hash = hashFor({ view: "papers", step: to });
  });
}
