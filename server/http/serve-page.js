// The page: app/layout.html with each include line replaced by the file it names, put together on every request.
import fs from "node:fs";
import path from "node:path";
import { root } from "./repo-root.js";
import { modulesImportedBy } from "./module-preload.js";

const INCLUDE = /^[ \t]*<!-- include: (\S+) -->[ \t]*\r?$/gm;
const PRELOAD = /^[ \t]*<!-- modulepreload: (\S+) -->[ \t]*\r?$/gm;

export function buildPage(url = "/app/layout.html") {
  const html = fs.readFileSync(path.join(root, url), "utf8");
  const page = html.replace(INCLUDE, (line, part) => {
    if (!fs.existsSync(path.join(root, part))) throw new Error(url + " includes " + part + ", which does not exist");
    return buildPage(part).replace(/\r?\n$/, "");
  }).replace(PRELOAD, (line, entry) => modulesImportedBy(entry).map((m) => '<link rel="modulepreload" href="' + m + '">').join("\n"));
  if (page.includes("<!-- include:") || page.includes("<!-- modulepreload:")) throw new Error(url + ": an include or modulepreload line must hold nothing else");
  return page;
}

export function servePage(req, res, next) {
  if ((req.method !== "GET" && req.method !== "HEAD") || (req.path !== "/" && req.path !== "/index.html")) return next();
  let page;
  try {
    page = buildPage();
  } catch (e) { // a missing or broken include: say why in the server's console, never in the browser
    console.error("page:", e.message);
    return res.status(500).type("text").send("The page could not be put together. The server's console says why.");
  }
  res.set("Cache-Control", "public, max-age=0").type("html").send(page);
}
