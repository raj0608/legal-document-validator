// The file that puts the demo online (render.yaml): it must stay free, run the demo, and hold no keys.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const yaml = fs.readFileSync(new URL("../../render.yaml", import.meta.url), "utf8");
const body = yaml.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
const pkg = JSON.parse(fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8"));

test("the Render blueprint is one free web service that runs the demo", () => {
  assert.match(body, /^\s+plan: free\s*$/m, "stays on the free plan");
  assert.equal((body.match(/^\s+- type:/gm) || []).length, 1, "one service only");
  assert.match(body, /^\s+- type: web\s*$/m, "a web service");
  assert.match(body, /^\s+startCommand: npm run demo\s*$/m, "demo mode: no keys, sample answers");
  assert.match(body, /^\s+healthCheckPath: \/api\/health\s*$/m);
  assert.ok(pkg.scripts.demo, "npm run demo exists");
});

test("the blueprint holds no key or token, and asks for none to be filled in", () => {
  assert.doesNotMatch(body, /API_KEY|ANTHROPIC|GEMINI|COURTLISTENER|TOKEN|SECRET|PASSWORD|sync: false/i);
  assert.doesNotMatch(body, /\b(AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9_-]{20,})\b/);
});

test("it asks for a Node version the project supports, and for one proxy so each visitor has their own limit", () => {
  const major = Number(/key: NODE_VERSION\s+value: "?(\d+)/.exec(body)[1]);
  const floor = Number(/>=\s*(\d+)/.exec(pkg.engines.node)[1]);
  assert.ok(major >= floor, `NODE_VERSION ${major} is below engines ${pkg.engines.node}`);
  assert.match(body, /key: TRUST_PROXY\s+value: "1"/);
});
