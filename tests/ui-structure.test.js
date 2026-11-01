// Safety net for the page's structure. The page is built from plain HTML and small modules, so a renamed id or a
// missing line of text would only show up as a broken screen. These tests read the files and check they agree.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { I18N } from "../shared/i18n/languages.js";
import { parseRoute, hashFor, VIEWS, MENU } from "../shared/screen-map.js";
import { buildPage } from "../server/http/page.js";

const html = buildPage();
const jsDir = new URL("../web/js/", import.meta.url);
const sources = fs.readdirSync(jsDir).filter((f) => f.endsWith(".js")).map((f) => [f, fs.readFileSync(new URL(f, jsDir), "utf8")]);
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));

test("every element the scripts look up by id exists in the page, and no id is used twice", () => {
  for (const [file, src] of sources) {
    for (const m of src.matchAll(/\$\("([A-Za-z0-9_-]+)"\)/g)) assert.ok(ids.has(m[1]), file + " needs #" + m[1]);
  }
  const all = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(all.length, ids.size, "duplicate ids: " + all.filter((x, i) => all.indexOf(x) !== i));
  for (const v of VIEWS) assert.ok(ids.has("view-" + v), "view-" + v);
});

test("every line of page text the HTML and scripts ask for exists in English and Spanish", () => {
  const keys = new Set();
  for (const m of html.matchAll(/data-i18n(?:-ph)?="([^"]+)"/g)) keys.add(m[1]);
  // t("hol_" + id) and t("st" + n) build the key in code, so only whole literal keys are checked here
  for (const [, src] of sources) for (const m of src.matchAll(/\bt\("([a-z0-9_]+)"(?!\s*\+)/g)) keys.add(m[1]);
  for (let n = 1; n <= 4; n++) keys.add("st" + n);
  for (const id of ["newyear", "mlk", "goodfriday", "primary", "memorial", "independence", "labor", "columbus", "general", "veterans", "thanksgiving", "christmas"]) keys.add("hol_" + id);
  for (const k of keys) {
    assert.ok(typeof I18N.en[k] !== "undefined", "missing in English: " + k);
    assert.ok(typeof I18N.es[k] !== "undefined", "missing in Spanish: " + k);
  }
  assert.deepEqual(Object.keys(I18N.es).filter((k) => !(k in I18N.en)), [], "Spanish has keys English does not");
});

test("every link inside the page goes somewhere that exists", () => {
  for (const m of html.matchAll(/href="(#[^"]*)"/g)) {
    if (m[1] === "#main") continue;
    const r = parseRoute(m[1]);
    assert.equal(hashFor(r), m[1], m[1] + " is not a real address");
  }
});

test("every screen has exactly one main heading, and a way back Home", () => {
  for (const v of VIEWS) {
    const section = new RegExp('<section id="view-' + v + '"[\\s\\S]*?</section>\\s*(?=<!--|</main>)').exec(html);
    assert.ok(section, v);
    assert.equal((section[0].match(/<h1[\s>]/g) || []).length, 1, v + " h1");
    if (v !== "home") assert.match(section[0], /class="back-home" href="#(home|help)"/, v + " back link");
  }
});

test("the menu is the same four places on every screen, and each links to a real screen", () => {
  const nav = /<nav class="main-nav"[\s\S]*?<\/nav>/.exec(html)[0];
  const links = [...nav.matchAll(/<a href="#(\w+)" data-view="(\w+)"/g)];
  assert.deepEqual(links.map((m) => m[2]), MENU.map((m) => m.view));
  for (const m of links) assert.equal(m[1], m[2]);
  for (const m of MENU) assert.ok(html.includes('data-i18n="' + m.key + '"'), m.key);
});

test("Home offers the four things a person comes for, as large links, and the notice that this is not legal advice", () => {
  const home = /<section id="view-home"[\s\S]*?<\/section>/.exec(html)[0];
  assert.deepEqual([...home.matchAll(/class="card-link" href="([^"]+)"/g)].map((m) => m[1]), ["#papers", "#check", "#check/clerk", "#help"]);
  assert.match(home, /data-i18n="notice_banner"/);
});

test("buttons and links that start a step say what they do", () => {
  const steps = /<section id="view-papers"[\s\S]*?(?=\s*<!-- Check my form)/.exec(html)[0];
  assert.equal((steps.match(/class="step" data-step="\d"/g) || []).length, 4);
  assert.match(steps, /id="papersNext1"[^>]*disabled/, "Continue waits for a paper");
});

test("no page text uses words the plain-language guide rules out", () => {
  const banned = /\b(utilize|commence|pursuant|herein|aforementioned|thereof)\b/i;
  for (const k of Object.keys(I18N.en)) {
    for (const v of [].concat(I18N.en[k])) if (typeof v === "string") assert.doesNotMatch(v, banned, k);
  }
});

test("the screens for people avoid telling them what to do in their own case", () => {
  // Same idea as the reply flag: the page's own words must not say what someone should do about their case.
  const bad = /\b(you should|you must|you need to|we recommend)\b/i;
  for (const k of Object.keys(I18N.en)) {
    for (const v of [].concat(I18N.en[k])) if (typeof v === "string") assert.doesNotMatch(v, bad, k);
  }
});

test("steps 1 to 3 of My papers never send the person out of the path; reminders are on step 3 itself", () => {
  const papers = /<section id="view-papers"[\s\S]*?(?=\s*<!-- Check my form)/.exec(html)[0];
  for (const n of [1, 2, 3]) {
    const step = new RegExp('<div class="step" data-step="' + n + '"[\\s\\S]*?(?=<div class="step" data-step="|<p class="disclaim")').exec(papers)[0];
    assert.doesNotMatch(step, /<a [^>]*href="#/, "step " + n + " has a link out of the path");
  }
  const step3 = /<div class="step" data-step="3"[\s\S]*?(?=<div class="step" data-step="4")/.exec(papers)[0];
  for (const needle of ['class="quick rem-chips"', 'id="flowDateList"', 'id="flowIcsBtn"', 'data-step-go="next"', 'data-step-go="back"']) assert.ok(step3.includes(needle), needle);
});

test("My dates is still its own page with its own reminders and calendar file", () => {
  const dates = /<section id="view-dates"[\s\S]*?<\/section>/.exec(html)[0];
  for (const needle of ['class="quick rem-chips"', 'id="dateList"', 'id="icsBtn"', 'id="saveDates"']) assert.ok(dates.includes(needle), needle);
  assert.match(html, /<a href="#dates" data-view="dates">/, "and it is in the menu");
});
