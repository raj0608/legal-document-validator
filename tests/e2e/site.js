// What every browser test needs: the real site on a random port (in demo mode, so there is no key and the answers are fixed), and
// Chrome to look at it. Chrome is the one already on the computer (or CHROME_PATH): nothing is downloaded, and nothing is skipped quietly:
// without Chrome a browser test fails and says so.
import { chromium } from "playwright-core";
import { createApp } from "../../server/http/app.js";
import { createAnthropicAi } from "../../server/ai/adapters/anthropic.js";
import { demoClient } from "../../server/ai/adapters/demo-client.js";
import { createDemoLookup } from "../../server/citations/demo-lookup.js";
import { sampleDocket } from "../../server/court/sample-docket.js";

export async function startSite() {
  const ai = createAnthropicAi({ client: demoClient(), model: "demo" });
  const app = createApp({ ai, citations: createDemoLookup(), docket: sampleDocket, config: { demo: true, log: false, rateLimitPerMin: 100000, dailyCap: 1e9 } });
  const server = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  return { base: "http://127.0.0.1:" + server.address().port, close: () => new Promise((r) => { server.closeAllConnections(); server.close(() => r()); }) };
}

export async function launch() {
  try { return await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: "chrome" }) }); }
  catch (e) { throw new Error("The browser tests need Google Chrome (or set CHROME_PATH to a Chrome or Chromium). " + String(e.message).split("\n")[0]); }
}

// A page that remembers what went wrong in it: errors in the console, failed requests, and answers of 400 or more it was not expecting.
export function watch(page, { allow = [] } = {}) {
  const problems = [];
  page.on("pageerror", (e) => problems.push("page error: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !allow.some((a) => m.text().includes(a))) problems.push("console: " + m.text()); });
  page.on("requestfailed", (r) => { if (!r.failure().errorText.includes("ERR_ABORTED")) problems.push("request failed: " + r.url()); });
  page.on("response", (r) => { if (r.status() >= 400 && !allow.some((a) => r.url().includes(a))) problems.push(`${r.status()} ${r.url()}`); });
  return { problems };
}

// Nothing about a person should be in the browser's storage, whatever they did.
export const storageIsEmpty = (page) => page.evaluate(async () => ({
  local: localStorage.length, session: sessionStorage.length, cookies: document.cookie.length,
  databases: (indexedDB.databases ? (await indexedDB.databases()).length : 0)
}));
