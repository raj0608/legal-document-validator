// Let’s Get Ready for Court: page start-up, routing and language text.
import { $ } from "/web/shared/lib/dom.js";
import { t } from "/web/shared/lib/page-text.js";
import { state, TR } from "/web/shared/state.js";
import { LANG } from "/shared/i18n/languages.js";
import { SAMPLE, TEST_PAPER, FORM_SAMPLE, CLERK_SAMPLE } from "/shared/sample-papers.js";
import { initAi } from "/web/shared/ui/ai-helper.js";
import { makeLoader, removeDoc, renderDoc } from "/web/shared/ui/document-slot.js";
import { renderSupport } from "/web/shared/layout/support-line.js";
import { renderSize, initPageControls } from "/web/shared/layout/page-controls.js";
import { initLang } from "/web/shared/layout/language-picker.js";
import { route, initNav, refreshNav } from "/web/shared/layout/router.js";
import { renderDates, initDates } from "/web/screens/dates/screen.js";
import { renderRemChips } from "/web/screens/dates/components/reminder-chips.js";
import { registerPapersSlot, initPapers } from "/web/screens/papers/screen.js";
import { renderFound } from "/web/screens/papers/components/found-in-paper.js";
import { renderQuick, abortChat } from "/web/screens/papers/components/chat.js";
import { registerCheckSlots, initCheck } from "/web/screens/check/screen.js";
import { renderChecks } from "/web/screens/check/components/form-checklist.js";
import { renderCure } from "/web/screens/check/components/fix-by-date.js";
import { renderFaq } from "/web/screens/help/screen.js";
import { renderPrivacy, initPrivacy } from "/web/screens/privacy/screen.js";
import { initClearEverything } from "/web/screens/privacy/components/clear-everything.js";

// ---------- Static text and language ----------
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

// ---------- Clear everything ----------
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

// ---------- Start ----------
registerCheckSlots();
registerPapersSlot();
initClearEverything(clearAll);
initPageControls(clearAll);
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
