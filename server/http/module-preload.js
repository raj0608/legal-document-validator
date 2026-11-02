// The modules a page script needs, found by following its import lines, so the page can ask for all of them at once
// instead of discovering them one level at a time.
import fs from "node:fs";
import path from "node:path";
import { root } from "./repo-root.js";

const IMPORT = /^import\s+(?:[^"';]*?\s+from\s+)?["']([^"']+)["']/gm;

export function modulesImportedBy(entry) {
  const found = [];
  const queue = [entry];
  for (let i = 0; i < queue.length; i++) {
    const src = fs.readFileSync(path.join(root, queue[i]), "utf8");
    for (const [, spec] of src.matchAll(IMPORT)) {
      const url = new URL(spec, "http://page" + queue[i]).pathname;
      if (!/^\/(app|shared)\//.test(url) || found.includes(url)) continue;
      found.push(url);
      queue.push(url);
    }
  }
  return found;
}
