// How the code is laid out, checked: imports resolve, shared/ stays plain, screens keep to themselves, only server/ai/ and the
// start files know which AI is used, and every file stays small and named for what it holds.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const IMPORT = /^import\s+(?:([^"';]*?)\s+from\s+)?["']([^"']+)["']/gm;
const EXPORT = /^export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([\w$]+)/gm;

const show = (file) => path.relative(root, file);
const filesIn = (dir) => fs.readdirSync(path.join(root, dir), { recursive: true }).filter((f) => /\.m?js$/.test(f)).map((f) => path.join(root, dir, f));
const namesIn = (clause = "") => (/\{([^}]*)\}/.exec(clause)?.[1] ?? "").split(",").map((n) => n.trim().split(/\s+as\s+/)[0]).filter(Boolean);
const importsOf = (file) => [...fs.readFileSync(file, "utf8").matchAll(IMPORT)].map((m) => ({ file, names: namesIn(m[1]), spec: m[2] }));
const exportsOf = (file) => new Set([...fs.readFileSync(file, "utf8").matchAll(EXPORT)].map((m) => m[1]));

function fileFor({ file, spec }) {
  if (spec.startsWith("/app/") || spec.startsWith("/shared/")) return path.join(root, spec);
  if (spec.startsWith("./") || spec.startsWith("../")) return path.resolve(path.dirname(file), spec);
  return null;
}

const code = ["app", "shared", "server"].flatMap(filesIn);
const imports = [...code, ...filesIn("tests")].flatMap(importsOf);

test("every import of a file in this project points at a file that exists", () => {
  for (const imp of imports) {
    const to = fileFor(imp);
    if (to) assert.ok(fs.existsSync(to), show(imp.file) + " imports " + imp.spec + ", which does not exist");
  }
});

test("every name imported from a file in this project is exported by that file", () => {
  for (const imp of imports) {
    const to = fileFor(imp);
    if (!to || !fs.existsSync(to)) continue;
    const exported = exportsOf(to);
    for (const name of imp.names) assert.ok(exported.has(name), show(imp.file) + " imports " + name + " from " + imp.spec + ", which does not export it");
  }
});

test("files in app/ import by address from the site root, even files in the same folder", () => {
  for (const imp of filesIn("app").flatMap(importsOf)) {
    assert.match(imp.spec, /^\/(app|shared|vendor)\//, show(imp.file) + " imports " + imp.spec + "; browser imports start with /app/, /shared/ or /vendor/");
  }
});

test("files in shared/ import only other shared/ files, by relative path, so the same code runs in the browser, the server and the tests", () => {
  const shared = path.join(root, "shared") + path.sep;
  for (const imp of filesIn("shared").flatMap(importsOf)) {
    assert.match(imp.spec, /^\.\.?\//, show(imp.file) + " imports " + imp.spec + "; shared/ imports start with ./ or ../");
    assert.ok(fileFor(imp).startsWith(shared), show(imp.file) + " imports " + imp.spec + ", which is outside shared/");
  }
});

test("the server's own code never imports from server/ai/ or an AI company's library: only main.js and demo.js plug an AI in", () => {
  const aiDir = path.join(root, "server", "ai") + path.sep;
  const starts = ["main.js", "demo.js"].map((f) => path.join(root, "server", f));
  const own = filesIn("server").filter((f) => !f.startsWith(aiDir) && !starts.includes(f));
  for (const imp of own.flatMap(importsOf)) {
    assert.ok(!(fileFor(imp) ?? "").startsWith(aiDir), show(imp.file) + " imports " + imp.spec + "; the rest of the server uses the AI it is given");
    assert.doesNotMatch(imp.spec, /^@anthropic-ai\/|^@google\/genai/, show(imp.file) + " imports " + imp.spec + "; the rest of the server uses the AI it is given");
  }
});

test("each thing is exported where it is written: no index.js files, and no export { } or export * lines", () => {
  for (const file of code) {
    assert.notEqual(path.basename(file), "index.js", show(file) + ": name the file for what it holds");
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), /^export\s*[{*]/m, show(file) + " has an export { } or export * line");
  }
});

test("a screen uses another screen only through its screen.js, never its components/ or lib/", () => {
  for (const file of filesIn("app/screens")) {
    const own = "/app/screens/" + path.relative(path.join(root, "app", "screens"), file).split(path.sep)[0] + "/";
    for (const imp of importsOf(file)) {
      if (!imp.spec.startsWith("/app/screens/") || imp.spec.startsWith(own)) continue;
      assert.match(imp.spec, /^\/app\/screens\/[\w-]+\/screen\.js$/, show(file) + " imports " + imp.spec + "; move what both screens need to app/shared/");
    }
  }
});

test("server/ never imports app/", () => {
  const browser = path.join(root, "app") + path.sep;
  for (const imp of filesIn("server").flatMap(importsOf)) {
    assert.ok(!(fileFor(imp) ?? "").startsWith(browser), show(imp.file) + " imports " + imp.spec + "; the server only serves app/, it never runs it");
  }
});

test("files in shared/ use nothing that only a browser or only Node has", () => {
  const GLOBAL = /(?<![\w.$])(?:(?:document|window|navigator|localStorage|sessionStorage|process|Buffer)\s*\.|(?:fetch|require)\s*\()/;
  for (const file of filesIn("shared")) {
    fs.readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      if (/^\s*(\/\/|\*)/.test(line)) return;
      assert.doesNotMatch(line, GLOBAL, show(file) + ":" + (i + 1) + " uses a browser or Node global; pass it in as an argument");
    });
  }
});

test("files stay under 200 lines, so each one holds one concern", () => {
  const pageText = path.join(root, "shared", "i18n") + path.sep;
  for (const dir of ["app", "shared", "server"]) {
    for (const f of fs.readdirSync(path.join(root, dir), { recursive: true }).filter((f) => /\.(m?js|css|html)$/.test(f))) {
      const file = path.join(root, dir, f);
      if (file.startsWith(pageText)) continue; // the page text in each language is one long list by design
      const lines = fs.readFileSync(file, "utf8").split("\n").length - 1;
      assert.ok(lines <= 200, show(file) + " has " + lines + " lines; split it by what its parts do");
    }
  }
});

test("no file or folder has a catch-all name like utils or helpers", () => {
  for (const dir of ["app", "shared", "server", "tests"]) {
    for (const f of fs.readdirSync(path.join(root, dir), { recursive: true })) {
      for (const part of f.split(path.sep)) {
        assert.doesNotMatch(part, /^(utils?|helpers?|misc|common|stuff)(\.\w+)?$/i, path.join(dir, f) + ": name it for what it holds");
      }
    }
  }
});

test("only app/main.js, server/main.js and server/demo.js do something when they load; every other file only defines things", () => {
  const starts = ["app/main.js", "server/main.js", "server/demo.js"].map((f) => path.join(root, f));
  for (const file of code.filter((f) => !starts.includes(f))) {
    let inText = false; // inside a `...` text that spans lines, where a line may start with anything
    fs.readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      const wasInText = inText;
      if ((line.match(/(?<!\\)`/g) || []).length % 2) inText = !inText;
      if (wasInText || !/^\S/.test(line)) return;
      assert.match(line, /^(import|export|function|async function|const|let|class|\/\/|\/\*|[}\])])/, show(file) + ":" + (i + 1) + " runs code when the file loads; put it in a function that a start file calls");
    });
  }
});
