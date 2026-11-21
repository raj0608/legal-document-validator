// The court staff side in a real browser: the staff home, the citation check, the returned-filing message, and the hearing board
// staying the same on two screens at once.
//   npm run test:e2e
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { startSite, launch, watch, storageIsEmpty } from "./site.js";
import { I18N } from "../../shared/i18n/languages.js";

let site, browser;
before(async () => { site = await startSite(); browser = await launch(); });
after(async () => { await browser.close(); await site.close(); });
const open = async (hash) => { const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } }); const page = await ctx.newPage(); const w = watch(page); await page.goto(site.base + "/" + hash); return { page, w, ctx }; };

// The board as the server holds it, read from the live feed's first event.
async function snapshot() {
  const res = await fetch(site.base + "/api/court/live");
  const reader = res.body.getReader();
  const { value } = await reader.read();
  await reader.cancel();
  return JSON.parse(/data: (.*)/.exec(new TextDecoder().decode(value))[1]);
}
const act = (id, action) => fetch(site.base + "/api/court/board/" + id, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });

test("the staff home has the four tools and the staff's own menu, and nothing about a tenant's case", async () => {
  const { page, w, ctx } = await open("#court");
  assert.equal(await page.locator("#view-court h1").innerText(), I18N.en.staff_home_h);
  assert.equal(await page.locator("#view-court .card-link").count(), 4);
  const menu = (await page.locator(".main-nav a:visible").allInnerTexts()).map((s) => s.trim());
  assert.deepEqual(menu, ["Staff home", "Hearing day", "90-day pauses", "Filings"]);
  assert.match(await page.locator("#view-court").innerText(), /made-up|made up/i);
  assert.deepEqual(w.problems, []);
  await ctx.close();
});

test("the citation check lists each case, says what it found in plain labels, and Hide this page empties it", async () => {
  const { page, w, ctx } = await open("#court/citations");
  await page.getByRole("button", { name: I18N.en.filing_sample_btn }).click();
  await page.locator("#citeBtn").click();
  await page.locator("#citeRows .cite-row").first().waitFor({ timeout: 15000 });
  const chips = await page.locator("#citeRows .cite-chip").allInnerTexts();
  assert.deepEqual(chips.sort(), ["Found", "Found", "Name differs", "Not found"]);
  assert.match(await page.locator("#citeReport").innerText(), /decides nothing|does not decide|did not check|A person has to read/i);
  await page.locator("#hide").click();
  await page.locator("#cover").waitFor({ state: "visible" });
  const html = await page.evaluate(() => document.documentElement.innerHTML);
  for (const word of ["Lindsey", "Goldberg", "Harper v. Riverside", "Hoosier Tenants Union"]) assert.ok(!html.includes(word), `"${word}" from the filing is still in the page after Hide this page`);
  assert.deepEqual(await storageIsEmpty(page), { local: 0, session: 0, cookies: 0, databases: 0 });
  assert.deepEqual(w.problems, []);
  await ctx.close();
});

test("the returned-filing message refuses a bad address, previews a good one, says nothing was sent, and keeps nothing", async () => {
  const { page, w, ctx } = await open("#court/return");
  const requests = [];
  page.on("request", (r) => requests.push(new URL(r.url()).host));
  await page.locator("#retR_not_signed").check();
  await page.locator("#retContact").fill("kimi@example.com\nBcc: attacker@evil.example");
  await page.locator("#retBtn").click();
  await page.waitForFunction((t) => document.getElementById("retStatus").innerText.includes(t), I18N.en.ret_err_contact.slice(0, 20));
  assert.equal(await page.locator("#retOut").isHidden(), true, "no preview for a bad address");
  await page.locator("#retContact").fill("kimi.sample@example.com");
  await page.locator("#retBtn").click();
  await page.locator("#retOut").waitFor({ state: "visible" });
  assert.match(await page.locator("#retOut").innerText(), /Nothing was sent/);
  assert.match(await page.locator("#retBody").innerText(), /\[Test message from a student prototype/);
  assert.deepEqual([...new Set(requests)], [new URL(site.base).host], "only this site was contacted");
  await page.locator("#retClear").click();
  assert.equal(await page.locator("#retContact").inputValue(), "");
  assert.equal(await page.locator("#retBody").innerText(), "");
  assert.deepEqual(await storageIsEmpty(page), { local: 0, session: 0, cookies: 0, databases: 0 });
  assert.deepEqual(w.problems.filter((p) => !/400/.test(p)), [], "only the expected refusal was an error");
  await ctx.close();
});

test("a change on one staff screen shows on another, and the board can be started over", async () => {
  const a = await open("#court/hearings"), b = await open("#court/hearings");
  await a.page.locator("#boardLanes .case-card").first().waitFor();
  await b.page.locator("#boardLanes .case-card").first().waitFor();
  const waiting = (await snapshot()).board.find((c) => c.stage === "waiting");
  assert.ok(waiting, "the sample docket has a case that has not arrived");
  const card = (page) => page.locator(`[data-open="${waiting.id}"]`);
  assert.match(await card(b.page).getAttribute("class"), /stage-waiting/);
  assert.equal((await act(waiting.id, { type: "arrive", party: "tenant", here: true })).status, 200);
  for (const page of [a.page, b.page]) await page.waitForFunction((id) => /stage-here/.test(document.querySelector(`[data-open="${id}"]`).className), waiting.id, { timeout: 8000 });
  await a.page.locator("#boardReset").click();
  await b.page.waitForFunction((id) => /stage-waiting/.test(document.querySelector(`[data-open="${id}"]`).className), waiting.id, { timeout: 8000 });
  assert.deepEqual(a.w.problems, []);
  await a.ctx.close(); await b.ctx.close();
});

test("a change the board cannot take is refused and the board is left as it was", async () => {
  const before = JSON.stringify((await snapshot()).board);
  const done = (await snapshot()).board.find((c) => c.stage === "done");
  assert.equal((await act(done.id, { type: "arrive", party: "tenant", here: true })).status, 400);
  assert.equal((await act("no-such-case", { type: "call" })).status, 404);
  assert.equal((await act(done.id, { type: "destroy-everything" })).status, 400);
  assert.equal(JSON.stringify((await snapshot()).board), before);
});

test("the 90-day pauses page and the agency page load with the made-up cases and no errors", async () => {
  for (const hash of ["#court/diversion", "#agency"]) {
    const { page, w, ctx } = await open(hash);
    await page.locator("#main h1:visible").waitFor();
    assert.deepEqual(w.problems, [], hash);
    await ctx.close();
  }
});
