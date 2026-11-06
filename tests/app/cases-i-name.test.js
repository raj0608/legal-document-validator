// The tenant's "Cases I name" mode on Check my form: its text exists in both languages, never gives advice, and is wired up.
import test from "node:test";
import assert from "node:assert/strict";
import { I18N } from "../../shared/i18n/languages.js";
import { VERDICTS } from "../../shared/analysis/citation-report.js";
import { looksLikeAdvice } from "../../shared/safety/advice.js";
import { buildPage } from "../../server/http/serve-page.js";

const html = buildPage();
const KEYS = ["mode_cites", "cites_sample_btn", "cites_sample_name", "cites_p", "cites_privacy", "cites_run", "cites_running", "cites_sum_h", "cites_sum_found", "cites_sum_check", "cites_sum_unchecked",
  "cites_cap", "cites_none", "cites_none_note", "cites_off", "cites_err_rate", "cites_limits", "cites_help", "mycite_in_filing", "mycite_times", "mycite_also", "mycite_open",
  ...VERDICTS.flatMap((v) => ["mycite_v_" + v, "mycite_d_" + v])];

test("every line of text for this mode exists in English and Spanish, including a label and a sentence for every verdict", () => {
  for (const k of KEYS) for (const lang of ["en", "es"]) assert.ok(typeof I18N[lang][k] === "string" && I18N[lang][k].length, lang + " " + k);
});

test("none of the words a tenant reads here tell them what to do in their own case", () => {
  for (const k of KEYS) for (const lang of ["en", "es"]) assert.ok(!looksLikeAdvice(I18N[lang][k]), lang + " " + k + ": " + I18N[lang][k]);
});

test("the mode is on Check my form, next to the other two, with its own panel and the privacy line before anything is added", () => {
  const check = /<section id="view-check"[\s\S]*?<\/section>/.exec(html)[0];
  assert.match(check, /id="modeCites"/);
  assert.match(check, /id="citesPanel"/);
  assert.match(check, /data-i18n="cites_privacy"/);
  assert.match(I18N.en.cites_privacy, /not saved/);
  assert.match(I18N.en.cites_privacy, /Only the case numbers/);
});

test("the page says what the check cannot do: read what a case says, or prove a missing case is not real", () => {
  assert.match(I18N.en.cites_limits, /cannot tell whether a case says what your filing uses it for/);
  assert.match(I18N.en.cites_limits, /does not show the case is not real/);
  assert.match(I18N.en.mycite_d_not_found, /does not mean the case is not real/);
});

test("Home still offers the same four cards: this mode is reached from Check my form", () => {
  const home = /<section id="view-home"[\s\S]*?<\/section>/.exec(html)[0];
  assert.deepEqual([...home.matchAll(/class="card-link" href="([^"]+)"/g)].map((m) => m[1]), ["#papers", "#check", "#check/clerk", "#help"]);
});
