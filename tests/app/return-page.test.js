// The return-for-correction page: its text exists in both languages, matches what the server can say, and is reachable.
import test from "node:test";
import assert from "node:assert/strict";
import { I18N } from "../../shared/i18n/languages.js";
import { REASON_IDS, OTHER_MAX } from "../../shared/notice/return-reasons.js";
import { REASONS } from "../../server/notify/templates.js";
import { parseRoute, hashFor, menuItemFor } from "../../shared/screen-map.js";
import { buildPage } from "../../server/http/serve-page.js";

const html = buildPage();

test("each reason has a checkbox label in English and Spanish, and a sentence and a short form for the message in both", () => {
  for (const id of REASON_IDS) {
    for (const lang of ["en", "es"]) {
      assert.ok(I18N[lang]["ret_r_" + id], `${lang} checkbox label for ${id}`);
      assert.equal(REASONS[lang][id].length, 2, `${lang} message text for ${id}`);
    }
  }
  assert.deepEqual(Object.keys(REASONS.en).sort(), [...REASON_IDS].sort());
  assert.deepEqual(Object.keys(REASONS.es).sort(), [...REASON_IDS].sort());
});

test("every error the server can give for this form has words on the page, in both languages", () => {
  for (const key of ["ret_err_contact", "ret_err_text", "ret_err_date", "ret_err_reason", "err_rate", "err_generic"]) {
    assert.ok(I18N.en[key] && I18N.es[key], key);
  }
});

test("the page says the free-text limit that the server enforces", () => {
  assert.equal(OTHER_MAX, 140);
  assert.match(I18N.en.ret_other_help, /140/);
  assert.match(I18N.es.ret_other_help, /140/);
  assert.match(html, /id="retOther"[^>]*maxlength="140"/);
});

test("the form says it is a preview, and the address or number is not saved, before anything is typed", () => {
  assert.match(html, /data-i18n="ret_not_sent_note"/);
  assert.match(I18N.en.ret_not_sent_note, /No email or text is sent/);
  assert.match(I18N.en.ret_not_sent_note, /not saved/);
  assert.match(I18N.en.ret_not_sent, /Nothing was sent/);
});

test("the contact box is not remembered by the browser", () => {
  assert.match(html, /id="retContact"[^>]*autocomplete="off"/);
  assert.match(html, /id="retOther"[^>]*autocomplete="off"/);
});

test("Return a filing sits under court staff, which sits under Home, and its address round-trips", () => {
  assert.deepEqual(parseRoute("#court/return"), { view: "return" });
  assert.equal(hashFor({ view: "return" }), "#court/return");
  assert.equal(hashFor({ view: "court" }), "#court");
  assert.equal(menuItemFor("return"), "home");
  assert.equal(menuItemFor("court"), "home");
});

test("both court staff pages link to each other, and mark the one you are on", () => {
  const court = /<section id="view-court"[\s\S]*?<\/section>/.exec(html)[0], ret = /<section id="view-return"[\s\S]*?<\/section>/.exec(html)[0];
  for (const page of [court, ret]) assert.match(page, /<nav class="court-tabs"[\s\S]*href="#court"[\s\S]*href="#court\/return"/);
  assert.match(court, /href="#court" aria-current="page"/);
  assert.match(ret, /href="#court\/return" aria-current="page"/);
});

test("neither court staff page is in the main menu, and Home does not offer them to tenants", () => {
  const nav = /<nav class="main-nav"[\s\S]*?<\/nav>/.exec(html)[0];
  assert.doesNotMatch(nav, /court/);
  assert.doesNotMatch(/<section id="view-home"[\s\S]*?<\/section>/.exec(html)[0], /#court/);
});
