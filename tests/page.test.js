// The page is put together from web/index.html when it is served: include lines are filled in, and a broken include
// stops the page instead of serving half of it.
import test from "node:test";
import assert from "node:assert/strict";
import { buildPage } from "../server/http/page.js";

test("the page holds every screen, and no include line is left in it", () => {
  const page = buildPage();
  for (const view of ["home", "papers", "check", "dates", "help", "privacy"]) assert.match(page, new RegExp('<section id="view-' + view + '"'), view);
  assert.doesNotMatch(page, /<!-- include:/);
});

test("a missing include, or an include line with anything else on it, stops the page", () => {
  assert.throws(() => buildPage("/tests/fixtures/pages/missing-include.html"), /includes \/tests\/fixtures\/pages\/no-such-file\.html, which does not exist/);
  assert.throws(() => buildPage("/tests/fixtures/pages/include-not-alone.html"), /must hold nothing else/);
});
