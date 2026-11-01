import test from "node:test";
import assert from "node:assert/strict";
import { parseRoute, hashFor, guard, menuItemFor, MENU, VIEWS, PAPER_STEPS } from "../../shared/screen-map.js";

test("addresses parse to a screen, and an empty or unknown one goes Home", () => {
  assert.deepEqual(parseRoute(""), { view: "home" });
  assert.deepEqual(parseRoute("#"), { view: "home" });
  assert.deepEqual(parseRoute("#nonsense"), { view: "home" });
  assert.deepEqual(parseRoute("#dates"), { view: "dates" });
  assert.deepEqual(parseRoute("#help"), { view: "help" });
  assert.deepEqual(parseRoute("#privacy"), { view: "privacy" });
});

test("the old Questions address still works", () => {
  assert.deepEqual(parseRoute("#questions"), { view: "help" });
});

test("papers has four steps and a bad step number never breaks", () => {
  assert.deepEqual(parseRoute("#papers"), { view: "papers", step: 1 });
  assert.deepEqual(parseRoute("#papers/3"), { view: "papers", step: 3 });
  assert.deepEqual(parseRoute("#papers/0"), { view: "papers", step: 1 });
  assert.deepEqual(parseRoute("#papers/99"), { view: "papers", step: PAPER_STEPS });
  assert.deepEqual(parseRoute("#papers/abc"), { view: "papers", step: 1 });
});

test("check has two modes", () => {
  assert.deepEqual(parseRoute("#check"), { view: "check", mode: "form" });
  assert.deepEqual(parseRoute("#check/clerk"), { view: "check", mode: "clerk" });
  assert.deepEqual(parseRoute("#check/whatever"), { view: "check", mode: "form" });
});

test("every address the page builds parses back to the same screen", () => {
  for (const r of [{ view: "home" }, { view: "papers", step: 1 }, { view: "papers", step: 4 }, { view: "check", mode: "form" }, { view: "check", mode: "clerk" }, { view: "dates" }, { view: "help" }, { view: "privacy" }]) {
    assert.deepEqual(parseRoute(hashFor(r)), r, hashFor(r));
  }
});

test("steps 2 to 4 need a paper", () => {
  assert.deepEqual(guard({ view: "papers", step: 3 }, false), { view: "papers", step: 1 });
  assert.deepEqual(guard({ view: "papers", step: 3 }, true), { view: "papers", step: 3 });
  assert.deepEqual(guard({ view: "papers", step: 1 }, false), { view: "papers", step: 1 });
  assert.deepEqual(guard({ view: "dates" }, false), { view: "dates" });
});

test("the menu has four places, and every screen lights one of them", () => {
  assert.equal(MENU.length, 4);
  for (const v of VIEWS) assert.ok(MENU.some((m) => m.view === menuItemFor(v)), v);
  assert.equal(menuItemFor("check"), "home");
  assert.equal(menuItemFor("privacy"), "help");
});
