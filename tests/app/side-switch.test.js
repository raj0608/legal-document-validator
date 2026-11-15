// The switch at the top of every page between the tenant's side and the court staff's side, and the staff side's own menu.
import test from "node:test";
import assert from "node:assert/strict";
import { I18N } from "../../shared/i18n/languages.js";
import { hashFor, STAFF_MENU, STAFF_VIEWS } from "../../shared/screen-map.js";
import { buildPage } from "../../server/http/serve-page.js";

const html = buildPage();

test("the switch sits above the header and opens each side's first page", () => {
  const sliver = /<div class="sliver">[\s\S]*?<header/.exec(html)[0];
  const sw = /<nav class="side-switch"[\s\S]*?<\/nav>/.exec(sliver)[0];
  assert.match(sw, /<a id="sideTenant" href="#home">/);
  assert.match(sw, /<a id="sideCourt" href="#court">/);
  for (const key of ["side_label", "side_tenant", "side_court"]) {
    assert.match(sw, new RegExp('data-i18n="' + key + '"'), key);
    for (const lang of ["en", "es"]) assert.ok(I18N[lang][key], lang + " " + key);
  }
});

test("the staff menu starts hidden, lists the staff places in order, and each link round-trips", () => {
  const nav = /<nav class="main-nav staff-nav" id="staffNav"[^>]*>[\s\S]*?<\/nav>/.exec(html)[0];
  assert.match(nav, /^<nav[^>]* hidden>/, "the tenant's menu shows first");
  const links = [...nav.matchAll(/<a href="(#[\w/]+)" data-view="(\w+)"/g)];
  assert.deepEqual(links.map((m) => m[2]), STAFF_MENU.map((m) => m.view));
  for (const m of links) {
    assert.equal(m[1], hashFor({ view: m[2] }));
    assert.ok(STAFF_VIEWS.includes(m[2]), m[2]);
  }
  for (const m of STAFF_MENU) for (const lang of ["en", "es"]) assert.ok(I18N[lang][m.key], lang + " " + m.key);
});
