// The page is put together from web/index.html when it is served: include lines are filled in, every module main.js
// needs is preloaded, and a broken include stops the page instead of serving half of it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildPage } from "../server/http/page.js";
import { root } from "../server/http/repo-root.js";

test("the page holds every screen, and no include or preload line is left in it", () => {
  const page = buildPage();
  for (const view of ["home", "papers", "check", "dates", "help", "privacy"]) assert.match(page, new RegExp('<section id="view-' + view + '"'), view);
  assert.doesNotMatch(page, /<!-- (include|modulepreload):/);
});

test("the page preloads every module main.js needs, once each, so the browser asks for them all at once", () => {
  const preloaded = [...buildPage().matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map((m) => m[1]);
  assert.equal(new Set(preloaded).size, preloaded.length, "a module is preloaded twice");
  for (const url of preloaded) assert.ok(fs.existsSync(path.join(root, url)), url + " is preloaded but does not exist");
  const web = fs.readdirSync(path.join(root, "web"), { recursive: true }).filter((f) => f.endsWith(".js")).map((f) => "/web/" + f.split(path.sep).join("/"));
  for (const url of web.filter((u) => u !== "/web/main.js")) assert.ok(preloaded.includes(url), url + " is not imported by anything main.js loads");
});

test("a missing include, or an include line with anything else on it, stops the page", () => {
  assert.throws(() => buildPage("/tests/fixtures/pages/missing-include.html"), /includes \/tests\/fixtures\/pages\/no-such-file\.html, which does not exist/);
  assert.throws(() => buildPage("/tests/fixtures/pages/include-not-alone.html"), /must hold nothing else/);
});
