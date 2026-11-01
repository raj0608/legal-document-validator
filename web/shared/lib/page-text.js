// The page's words in the chosen language, and the locale that dates and numbers use.
import { LANG, I18N } from "/shared/i18n/languages.js";
import { state, TR } from "/web/shared/state.js";

export const locale = () => LANG[state.lang].locale;

export function t(key, vars) {
  let s;
  if (state.lang === "en") s = I18N.en[key];
  else if (state.lang === "es") s = I18N.es[key];
  else s = TR[state.lang] && TR[state.lang].ui[key];
  if (s === undefined) s = I18N.en[key];
  if (vars && typeof s === "string") for (const k in vars) s = s.split("{" + k + "}").join(vars[k]);
  return s;
}
