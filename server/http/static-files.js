// The files the page loads: the browser app (app/), the shared modules, and the libraries and font from node_modules.
import path from "node:path";
import express from "express";
import { root } from "./repo-root.js";

// Only the kinds of file the browser asks for: markup goes out inside the page (page.js), and anything else kept beside the code stays off the site.
const only = (kinds, files) => (req, res, next) => (kinds.test(req.path) ? files(req, res, next) : next());

export function serveStaticFiles(app) {
  // Libraries and the font come from the npm packages, pinned in package.json, not from a CDN.
  const vendor = (dir) => express.static(path.join(root, "node_modules", dir), { maxAge: "1d", index: false, dotfiles: "ignore" });
  // pdf.js: its files, plus character maps (PDFs in Chinese, Japanese, Korean), image decoders, colour profiles and standard fonts
  for (const dir of ["cmaps", "wasm", "iccs", "standard_fonts"]) app.use("/vendor/pdfjs/" + dir, vendor("pdfjs-dist/" + dir));
  app.use("/vendor/pdfjs", vendor("pdfjs-dist/build"));
  app.use("/vendor/fonts", vendor("@fontsource/atkinson-hyperlegible"));
  app.use("/shared", only(/\.js$/, express.static(path.join(root, "shared"), { redirect: false })));
  app.use("/app", only(/\.(js|css)$/, express.static(path.join(root, "app"), { index: false, redirect: false })));
}
