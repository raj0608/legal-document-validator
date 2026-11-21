// The tenant side in a real browser: Home, the four steps, the advice gate, the case lookup, hostile text, Spanish, and "Hide this page".
//   npm run test:e2e
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { startSite, launch, watch, storageIsEmpty } from "./site.js";
import { I18N } from "../../shared/i18n/languages.js";
import { SAMPLE, FILING_SAMPLE } from "../../shared/sample-papers.js";

let site, browser;
before(async () => { site = await startSite(); browser = await launch(); });
after(async () => { await browser.close(); await site.close(); });
const open = async (hash = "#home") => { const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } }); const page = await ctx.newPage(); const w = watch(page); await page.goto(site.base + "/" + hash); return { page, w, ctx }; };

test("Home shows the four things a person comes for, the switch between sides, and no errors", async () => {
  const { page, w, ctx } = await open();
  assert.equal(await page.locator("#view-home h1").innerText(), I18N.en.home_h);
  assert.equal(await page.locator("#view-home .card-link").count(), 4);
  await page.locator(".side-switch a", { hasText: "For court staff" }).click();
  await page.waitForURL(/#court$/);
  assert.equal(await page.locator("#view-court h1").innerText(), I18N.en.staff_home_h);
  await page.locator(".side-switch a", { hasText: "For tenants" }).click();
  assert.equal(await page.locator("#view-home h1").innerText(), I18N.en.home_h);
  assert.deepEqual(w.problems, []);
  await ctx.close();
});

test("a sample paper goes through the four steps, and Hide this page leaves nothing behind", async () => {
  const { page, w, ctx } = await open("#papers");
  await page.getByRole("button", { name: I18N.en.sample_btn }).click();
  assert.match(await page.locator("#papersDoc").innerText(), /Sample paper|page/i);
  await page.locator("#papersNext1").click();
  await page.locator("#explainBtn").click();
  await page.waitForFunction(() => /\[Demo\]/.test(document.getElementById("explainOut").innerText), null, { timeout: 15000 });
  await page.locator('[data-step="2"] [data-step-go="next"]').click();
  await page.locator('#view-papers .step[data-step="3"]').waitFor({ state: "visible" });
  assert.match(await page.locator("#view-papers").innerText(), /November 24, 2026/, "the hearing date from the paper is shown");
  await page.locator("#hide").click();
  await page.locator("#cover").waitFor({ state: "visible" });
  // Hidden is not gone: look in all of the page's HTML, not only the part a person can see. These words are only in the sample paper.
  const html = await page.evaluate(() => document.documentElement.innerHTML);
  for (const word of ["Maple Row", "Kimi", "02D00-2611", "3,150", "initial status conference on", "Courthouse, Fort Wayne", "November 24"]) assert.ok(!html.includes(word), `"${word}" from the paper is still in the page after Hide this page`);
  assert.deepEqual(await storageIsEmpty(page), { local: 0, session: 0, cookies: 0, databases: 0 });
  assert.deepEqual(w.problems, []);
  await ctx.close();
});

test("a question that asks what to do gets the fixed refusal and never reaches the AI; an information question does", async () => {
  const { page, ctx } = await open("#papers");
  const asked = [];
  page.on("request", (r) => { if (r.url().endsWith("/api/chat")) asked.push(r.postDataJSON().turns.at(-1).content); });
  await page.getByRole("button", { name: I18N.en.sample_btn }).click();
  await page.locator("#papersNext1").click();
  await page.locator('[data-step="2"] [data-step-go="next"]').click();
  await page.locator('#view-papers .step[data-step="3"]').waitFor({ state: "visible" });
  await page.locator('[data-step="3"] [data-step-go="next"]').click();
  await page.locator('#view-papers .step[data-step="4"]').waitFor({ state: "visible" });
  await page.locator("#askInput").fill("Should I stop paying rent?");
  await page.locator("#askBtn").click();
  await page.waitForFunction(() => /can’t tell you what to do/.test(document.getElementById("thread").innerText));
  assert.deepEqual(asked, [], "the advice question was not sent to the server");
  await page.locator("#askInput").fill("What is a continuance?");
  await page.locator("#askBtn").click();
  await page.waitForFunction(() => /\[Demo\]/.test(document.getElementById("thread").innerText), null, { timeout: 15000 });
  assert.deepEqual(asked, ["What is a continuance?"]);
  await ctx.close();
});

test("removing a paper empties the dates and laws found in it, the explanation and the chat; the hearing date it added to My dates stays", async () => {
  const { page, ctx } = await open("#papers");
  await page.getByRole("button", { name: I18N.en.sample_btn }).click();
  await page.locator("#papersNext1").click();
  await page.locator("#explainBtn").click();
  await page.waitForFunction(() => /\[Demo\]/.test(document.getElementById("explainOut").innerText), null, { timeout: 15000 });
  assert.ok((await page.locator("#foundDates li").count()) > 0, "the paper's dates were found");
  await page.goto(site.base + "/#papers"); // back to step 1, where the paper can be removed
  await page.locator("#papersDoc .link-btn").click();
  const left = await page.evaluate(() => ["foundDates", "foundCites", "explainOut", "thread"].map((id) => [id, document.getElementById(id).textContent.trim()]).filter(([, t]) => t));
  assert.deepEqual(left, [], "text from the removed paper is still in the page");
  assert.match(await page.locator("#nextDate").innerText(), /November 24, 2026/, "the date added to My dates is kept: only Hide this page clears it");
  await ctx.close();
});

test("a tenant looks up the cases their filing names, sees plain words, and Hide this page empties it", async () => {
  const { page, w, ctx } = await open("#check/cites");
  await page.getByRole("button", { name: I18N.en.cites_sample_btn }).click();
  await page.locator("#citesBtn").click();
  await page.locator("#citesRows .cite-row").first().waitFor({ timeout: 15000 });
  const rows = await page.locator("#citesRows .cite-row").allInnerTexts();
  assert.equal(rows.length, 4);
  assert.ok(rows.some((r) => /Matches a real case/.test(r)) && rows.some((r) => /Not found/.test(r)));
  assert.doesNotMatch(await page.locator("#citesReport").innerText(), /\b(you should|you must|you need to)\b/i);
  await page.locator("#hide").click();
  await page.locator("#cover").waitFor({ state: "visible" });
  assert.equal(await page.locator("#citesRows").evaluate((e) => e.children.length), 0);
  assert.doesNotMatch(await page.locator("body").innerText(), /Lindsey|Goldberg|Mathews/);
  assert.deepEqual(await storageIsEmpty(page), { local: 0, session: 0, cookies: 0, databases: 0 });
  assert.deepEqual(w.problems, []);
  await ctx.close();
});

test("hostile text in a pasted paper is shown as text and never runs", async () => {
  const { page, ctx } = await open("#papers");
  await page.getByRole("button", { name: I18N.en.paste_btn }).click();
  await page.locator("#papersLoader .paste textarea").fill(SAMPLE + "\n<img src=x onerror=\"window.__pwned=1\"> <script>window.__pwned=2</script> javascript:window.__pwned=3 <b onmouseover=window.__pwned=4>bold</b>");
  await page.getByRole("button", { name: I18N.en.paste_use }).click();
  await page.locator("#papersNext1").click();
  await page.locator("#explainBtn").click();
  await page.waitForFunction(() => /\[Demo\]/.test(document.getElementById("explainOut").innerText), null, { timeout: 15000 });
  assert.equal(await page.evaluate(() => window.__pwned), undefined, "nothing in the paper ran as code");
  assert.equal(await page.locator('img[src="x"], #main script').count(), 0, "no image or script element was made from the paper's text");
  await ctx.close();
});

test("switching to Spanish changes the page, the page language and the staff side too", async () => {
  const { page, ctx } = await open();
  await page.locator("#lang").selectOption("es");
  await page.waitForFunction((t) => document.querySelector("#view-home h1").innerText === t, I18N.es.home_h);
  assert.equal(await page.evaluate(() => document.documentElement.lang), "es");
  await page.locator(".side-switch a[href='#court']").click();
  await page.waitForFunction((t) => document.querySelector("#view-court h1").innerText === t, I18N.es.staff_home_h);
  await ctx.close();
});

test("a filing with a full-width, hidden-character citation is still read and checked", async () => {
  const { page, ctx } = await open("#check/cites");
  await page.getByRole("button", { name: I18N.en.paste_btn }).click();
  await page.locator("#citesLoader .paste textarea").fill("See Goldberg v. Kelly, ３９７ U.S.​ ２５４ (1970).");
  await page.getByRole("button", { name: I18N.en.paste_use }).click();
  await page.locator("#citesBtn").click();
  await page.locator("#citesRows .cite-row").first().waitFor({ timeout: 15000 });
  assert.match(await page.locator("#citesRows").innerText(), /397 U\.S\. 254[\s\S]*Matches a real case/);
  await ctx.close();
});

void FILING_SAMPLE;
