// The rule files for AI coding tools stay in a shape every tool can read: AGENTS.md files hold the rules,
// each CLAUDE.md only points at the AGENTS.md beside it, and no file for a single tool hides them from the others.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const show = (file) => path.relative(root, file);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const file = path.join(dir, entry.name);
    out.push({ file, entry });
    if (entry.isDirectory()) walk(file, out);
  }
  return out;
}
const everything = walk(root);
const named = (name) => everything.filter(({ entry }) => entry.name === name);
const agents = named("AGENTS.md").map(({ file }) => file);

test("AGENTS.md and CLAUDE.md are plain files, because Windows checks symlinks out as one-line text files", () => {
  for (const { file, entry } of [...named("AGENTS.md"), ...named("CLAUDE.md")]) assert.ok(!entry.isSymbolicLink(), show(file) + " is a symlink");
});

test("each CLAUDE.md holds only the line @AGENTS.md, and every AGENTS.md has one beside it", () => {
  for (const { file } of named("CLAUDE.md")) {
    assert.match(fs.readFileSync(file, "utf8"), /^@AGENTS\.md\r?\n?$/, show(file) + " must hold only the line @AGENTS.md; rules go in AGENTS.md");
  }
  for (const file of agents) {
    assert.ok(fs.existsSync(path.join(path.dirname(file), "CLAUDE.md")), show(file) + " needs a CLAUDE.md beside it holding @AGENTS.md, or Claude Code never reads it");
  }
});

test("there is no rule file for a single tool, which would hide AGENTS.md from the others", () => {
  for (const name of [".rules", ".cursorrules", ".windsurfrules", ".clinerules", "AGENT.md", "GEMINI.md", "AGENTS.override.md", "copilot-instructions.md"]) {
    for (const { file } of named(name)) assert.fail(show(file) + ": put its rules in AGENTS.md instead");
  }
});

test("the rule files stay short enough for every tool to read them whole", () => {
  const bytes = new Map(agents.map((file) => [file, fs.statSync(file).size]));
  for (const file of agents) {
    assert.ok(fs.readFileSync(file, "utf8").split("\n").length < 200, show(file) + " has 200 lines or more; keep traps, not maps");
  }
  const top = bytes.get(path.join(root, "AGENTS.md")) ?? 0;
  const largestArea = Math.max(0, ...agents.filter((file) => path.dirname(file) !== root).map((file) => bytes.get(file)));
  assert.ok(top + largestArea < 24000, "AGENTS.md plus the largest area file is " + (top + largestArea) + " bytes; some tools cut rules off at 24,000");
});

test("an @ followed by a path appears only inside backticks, because some tools load @path as a file", () => {
  for (const file of agents) {
    const prose = fs.readFileSync(file, "utf8").replace(/`[^`\n]*`/g, "");
    assert.doesNotMatch(prose, /(^|\s)@[\w./]/m, show(file) + " has an @ outside backticks");
  }
});
