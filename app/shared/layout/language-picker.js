// Language picker. English and Spanish are built in; the others are machine-translated by the server.
import { $, el } from "/app/shared/lib/dom.js";
import { state, TR } from "/app/shared/state.js";
import { toast } from "/app/shared/ui/toast.js";
import { LANGS, I18N } from "/shared/i18n/languages.js";
import { ai, PERMANENT, disableAi } from "/app/shared/ui/ai-helper.js";
import * as api from "/app/shared/api/client.js";

async function translateTo(code) {
  if (code === "en" || code === "es" || TR[code]) return true;
  if (!ai.on) { toast(I18N.en.translate_off); return false; }
  $("langnote").hidden = false;
  $("langnote").textContent = I18N.en.translating;
  try {
    TR[code] = await api.translate(code); // { ui, faq }, already checked by the server
    return true;
  } catch (e) {
    if (e && PERMANENT.includes(e.code)) disableAi();
    toast(I18N.en.translate_fail);
    return false;
  }
}

export function initLang(applyText) {
  const sel = $("lang");
  LANGS.forEach(([code, label]) => { const o = el("option", null, label); o.value = code; sel.appendChild(o); });
  sel.addEventListener("change", async () => {
    const code = sel.value;
    state.lang = code;
    applyText();
    if (code !== "en" && code !== "es" && !TR[code]) {
      sel.disabled = true;
      await translateTo(code);
      sel.disabled = false;
      if (state.lang === code) applyText();
    }
  });
}
