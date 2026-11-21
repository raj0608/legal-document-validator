// Phones and access in a real browser, on every screen of both sides: nothing scrolls sideways, one heading each, every control has a
// name and is big enough to tap, the keyboard gets everywhere and shows where it is, and focus moves to the new heading.
//   npm run test:e2e
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { startSite, launch, watch } from "./site.js";
import { VIEWS } from "../../shared/screen-map.js";

const ROUTES = ["#home", "#papers", "#check", "#check/clerk", "#check/cites", "#dates", "#help", "#help/privacy", "#court", "#court/hearings", "#court/diversion", "#court/citations", "#court/return", "#agency"];
let site, browser;
before(async () => { site = await startSite(); browser = await launch(); });
after(async () => { await browser.close(); await site.close(); });
const phone = async (big = false) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const w = watch(page);
  await page.goto(site.base + "/");
  if (big) await page.locator("#size").click();
  return { page, w, ctx };
};
const go = async (page, hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForFunction(() => document.querySelectorAll("section.view:not([hidden])").length === 1); await page.waitForTimeout(150); };

// Everything the page asks of a screen reader and a thumb, measured in the page.
const audit = () => {
  const visible = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && !e.closest("[hidden]"); };
  // textContent, not innerText: the text inside a closed <details> is not drawn, so innerText is empty there
  const name = (e) => (e.getAttribute("aria-label") || (e.getAttribute("aria-labelledby") && e.getAttribute("aria-labelledby").split(" ").map((id) => (document.getElementById(id) || {}).textContent || "").join(" ")) || e.textContent || e.value || e.title || (e.labels && [...e.labels].map((l) => l.textContent).join(" ")) || "").trim();
  const out = { overflow: document.documentElement.scrollWidth - window.innerWidth, h1: 0, heading: "", jumps: [], noName: [], small: [], noLabel: [], lang: document.documentElement.lang };
  const view = document.querySelector("section.view:not([hidden])");
  const hs = [...view.querySelectorAll("h1,h2,h3,h4")].filter(visible);
  out.h1 = hs.filter((h) => h.tagName === "H1").length;
  out.heading = (hs.find((h) => h.tagName === "H1") || {}).textContent || "";
  let last = 0;
  for (const h of hs) { const lvl = Number(h.tagName[1]); if (last && lvl > last + 1) out.jumps.push(h.tagName + " after H" + last + ": " + h.textContent.trim().slice(0, 30)); last = lvl; }
  for (const e of document.querySelectorAll("#main button, #main a[href], #main input:not([type=hidden]), #main select, #main textarea, .main-nav a, .side-switch a, header button, header select")) {
    if (!visible(e) || e.closest(".sr, .skip")) continue;
    const id = e.id || e.textContent.trim().slice(0, 30) || e.tagName;
    if (!name(e)) out.noName.push(e.tagName + " " + id);
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName) && e.type !== "file" && !name(e)) out.noLabel.push(id);
    const r = e.getBoundingClientRect();
    const inline = e.tagName === "A" && e.closest("p, li, .ctx, .small, .lede, .disclaim, td, summary, details, .crumbs, footer, .foot-notes") && !e.closest(".card-link, .main-nav, .side-switch, .court-tabs");
    const checkbox = e.type === "checkbox" || e.type === "radio";
    if (!inline && !checkbox && Math.min(r.height, 9999) < 44) out.small.push(`${id} (${Math.round(r.width)}x${Math.round(r.height)})`);
  }
  return out;
};

test("every screen of both sides, on a 375-pixel phone: no sideways scroll, one heading, headings in order, a page language", async () => {
  const { page, w, ctx } = await phone();
  const bad = [];
  for (const hash of ROUTES) {
    await go(page, hash);
    const a = await page.evaluate(audit);
    if (a.overflow > 0) bad.push(`${hash}: scrolls sideways by ${a.overflow}px`);
    if (a.h1 !== 1) bad.push(`${hash}: ${a.h1} main headings`);
    if (a.jumps.length) bad.push(`${hash}: heading levels skip: ${a.jumps.join("; ")}`);
    if (!a.lang) bad.push(`${hash}: no page language`);
  }
  console.log(`eval phone layout: ${ROUTES.length - new Set(bad.map((b) => b.split(":")[0])).size}/${ROUTES.length} screens clean`);
  assert.deepEqual(bad, []);
  assert.deepEqual(w.problems, []);
  assert.equal(ROUTES.length, VIEWS.length + 2, "a screen was added: add its address to this test (home sub-views papers, check and its modes count once each)");
  await ctx.close();
});

test("every button, link and field on every screen has a name a screen reader can say", async () => {
  const { page, ctx } = await phone();
  const bad = [];
  for (const hash of ROUTES) { await go(page, hash); const a = await page.evaluate(audit); if (a.noName.length) bad.push(`${hash}: ${a.noName.join(", ")}`); }
  assert.deepEqual(bad, []);
  await ctx.close();
});

test("buttons, menu items and cards are big enough to tap (44 pixels) on every screen", async () => {
  const { page, ctx } = await phone();
  const bad = [];
  for (const hash of ROUTES) { await go(page, hash); const a = await page.evaluate(audit); if (a.small.length) bad.push(`${hash}: ${a.small.join(", ")}`); }
  console.log(`eval phone layout: ${ROUTES.length - bad.length}/${ROUTES.length} screens have only big-enough controls`);
  assert.deepEqual(bad, []);
  await ctx.close();
});

test("with the bigger-text button on, nothing scrolls sideways on a phone", async () => {
  const { page, ctx } = await phone(true);
  const bad = [];
  for (const hash of ROUTES) { await go(page, hash); const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (o > 0) bad.push(`${hash}: ${o}px`); }
  assert.deepEqual(bad, []);
  await ctx.close();
});

test("the keyboard: the first stop is the skip link, it works, and every stop shows where focus is", async () => {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(site.base + "/");
  await page.keyboard.press("Tab");
  assert.match(await page.evaluate(() => document.activeElement.className + " " + document.activeElement.textContent), /skip|Skip to the main/);
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => document.activeElement.id), "main");
  await page.goto(site.base + "/");
  const stops = [];
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Tab");
    stops.push(await page.evaluate(() => { const e = document.activeElement, s = getComputedStyle(e); return { tag: e.tagName, label: (e.getAttribute("aria-label") || e.innerText || e.id || "").trim().slice(0, 30), ring: s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2 }; }));
  }
  const noRing = stops.filter((s) => !s.ring).map((s) => `${s.tag} ${s.label}`);
  console.log(`eval keyboard: ${stops.length - noRing.length}/${stops.length} tab stops show a focus ring`);
  assert.deepEqual(noRing, []);
  assert.ok(new Set(stops.map((s) => s.label)).size > 12, "the tab key reaches many different controls");
  await ctx.close();
});

test("moving to another screen moves focus to its heading, so a screen reader says where the person is", async () => {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(site.base + "/");
  const wrong = [];
  for (const hash of ["#dates", "#help", "#check", "#court", "#court/hearings", "#court/return", "#home"]) {
    await page.evaluate((h) => { location.hash = h; }, hash);
    await page.waitForTimeout(250);
    const ok = await page.evaluate(() => document.activeElement && document.activeElement.tagName === "H1" && !!document.activeElement.closest("section.view:not([hidden])"));
    if (!ok) wrong.push(hash);
  }
  assert.deepEqual(wrong, []);
  await ctx.close();
});
