// Let’s Get Ready for Court: page start-up, routing, language text, and the clear / hide / text-size controls.
import { $, t, state, TR, renderSupport, toast } from "./core.js";
import { LANG } from "/shared/i18n/languages.js";
import { SAMPLE, TEST_PAPER, FORM_SAMPLE, CLERK_SAMPLE } from "/shared/sample-papers.js";
import { initAi } from "./ai.js";
import { makeLoader, removeDoc, renderDoc } from "./docs.js";
import { renderDates, renderRemChips, initDates } from "./dates-view.js";
import { renderFound, renderQuick, initPapers, abortChat } from "./papers-view.js";
import { renderChecks, renderCure, initCheck } from "./check-view.js";
import { renderFaq, renderPrivacy, initPrivacy } from "./content-view.js";
import { initLang } from "./lang.js";
import { route, initNav, refreshNav } from "./nav.js";

// ---------- Static text and language ----------
function renderSize() {
  const big = document.documentElement.classList.contains("big");
  $("sizeIcon").textContent = big ? "A−" : "A+";
  $("sizeLabel").textContent = big ? t("size_down") : t("size_up");
}

function applyText() {
  const L = LANG[state.lang];
  document.documentElement.lang = state.lang === "en" || state.lang === "es" || TR[state.lang] ? state.lang : "en";
  document.documentElement.dir = L.rtl && (TR[state.lang] || false) ? "rtl" : "ltr";
  document.querySelectorAll("[data-i18n]").forEach((e) => { const v = t(e.dataset.i18n); if (typeof v === "string") e.textContent = v; });
  document.querySelectorAll("[data-i18n-ph]").forEach((e) => { e.placeholder = t(e.dataset.i18nPh); });
  const note = state.lang === "en" ? "" : t("lang_machine");
  $("langnote").textContent = note;
  $("langnote").hidden = !note;
  renderSize(); renderSupport(); renderQuick(); renderRemChips(); renderFaq(); renderPrivacy(); renderDates();
  renderDoc("papers"); renderDoc("form"); renderDoc("clerk");
  if (state.papers) renderFound();
  if (state.form) renderChecks();
  if (state.clerk) renderCure();
  refreshNav();
}

// ---------- Clear, hide, text size ----------
function clearAll() {
  abortChat();
  ["papers", "form", "clerk"].forEach(removeDoc);
  state.chatTokens = null;
  $("askInput").value = "";
  $("smsTo").value = "";
  $("smsList").textContent = "";
  $("extraNames").value = "";
  state.dates = { notice: "", days: 15, served: "", hearing: "", time: "", place: "", cure: "", fromPaper: false };
  renderDates();
}
const closeConfirm = () => { $("clearConfirm").hidden = true; $("clearAll").hidden = false; };
$("clearAll").addEventListener("click", () => { $("clearAll").hidden = true; $("clearConfirm").hidden = false; $("clearNo").focus(); });
$("clearNo").addEventListener("click", () => { closeConfirm(); $("clearAll").focus(); });
$("clearYes").addEventListener("click", () => { clearAll(); closeConfirm(); toast(t("cleared")); });
$("hide").addEventListener("click", () => { clearAll(); $("cover").hidden = false; $("startOver").focus(); });
$("startOver").addEventListener("click", () => { $("cover").hidden = true; location.hash = "#home"; });
$("size").addEventListener("click", () => {
  document.documentElement.classList.toggle("big", !document.documentElement.classList.contains("big"));
  renderSize();
});

// ---------- Start ----------
// The "safety test paper" is for the team, not for the people this is built for: it only shows up with ?tester in the address.
const tester = /[?&]tester\b/.test(location.search);
makeLoader("papers", [{ btn: "sample_btn", name: "sample_name", text: SAMPLE }].concat(tester ? [{ btn: "test_btn", name: "test_name", text: TEST_PAPER }] : []));
makeLoader("form", [{ btn: "form_sample_btn", name: "form_sample_name", text: FORM_SAMPLE }]);
makeLoader("clerk", [{ btn: "clerk_sample_btn", name: "clerk_sample_name", text: CLERK_SAMPLE }]);
initLang(applyText);
initDates(); initPapers(); initCheck(); initPrivacy();
initNav();
route({ initial: true });
applyText();
initAi();
