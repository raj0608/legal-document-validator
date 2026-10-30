// Reading the text of a PDF with pdf.js, including what a person typed into fillable form fields.
// `lib` is pdf.js (window.pdfjsLib in the browser, the pdfjs-dist package in tests).
//
// Why this exists: pdf.js's plain text extraction leaves out the values of fillable fields completely, and
// for a "flattened" form (filled in, then saved as a plain PDF) it returns the typed values at the end of the
// page, away from their labels. Either way the checklist would see "Signature:" with nothing after it.

const BLANK = "____________________";
const ROW = 6; // how far apart (in PDF points) two pieces of text can be and still count as the same row

// The text exactly as the single-file prototype built it.
function plainText(items) {
  let s = "";
  for (const it of items) { s += it.str; s += it.hasEOL ? "\n" : " "; }
  return s;
}

function toLines(items) {
  const lines = [];
  let cur = [];
  const flush = () => { if (cur.length) { lines.push({ items: cur }); cur = []; } };
  for (const it of items) {
    if (typeof it.str !== "string") continue;
    if (it.str !== "") cur.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width || 0 });
    if (it.hasEOL) flush();
  }
  flush();
  return lines;
}

// A fillable field as a piece of text. Empty fields look like the blanks on a paper form.
function widgetItem(a) {
  if (!a || a.subtype !== "Widget" || !a.rect) return null;
  const [x1, y1, x2, y2] = a.rect;
  if (x2 - x1 < 4 || y2 - y1 < 4) return null;
  let str = null;
  if (a.fieldType === "Tx" || a.fieldType === "Ch") {
    const v = Array.isArray(a.fieldValue) ? a.fieldValue.join(", ") : a.fieldValue;
    const text = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
    str = text || (a.readOnly ? null : BLANK);
  } else if (a.fieldType === "Btn" && !a.pushButton) {
    const on = a.radioButton ? a.fieldValue === a.buttonValue : Boolean(a.fieldValue) && a.fieldValue !== "Off";
    str = on ? "[x]" : "[ ]";
  }
  return str === null ? null : { str, x: x1, y: (y1 + y2) / 2 - 3, w: x2 - x1, box: a.fieldType === "Btn" };
}

const sameRow = (item, y) => Math.abs(item.y - y) <= ROW;

const PRINTED_BOX = /^[☐□◻⬜]/u;
function swapPrintedBox(lines, w) {
  let best = null, bestD = Infinity;
  for (const L of lines) for (const i of L.items) {
    const dx = Math.abs(i.x - w.x), dy = Math.abs(i.y - w.y);
    if (PRINTED_BOX.test(i.str.trim()) && dx <= 25 && dy <= 16 && dx + dy < bestD) { best = i; bestD = dx + dy; }
  }
  if (!best) return false;
  best.str = best.str.trim().replace(PRINTED_BOX, w.str);
  return true;
}

// Rebuild a page's text so that values sit next to their labels.
export function assemblePage(tcItems, widgets) {
  const lines = toLines(tcItems);
  let changed = false;

  // 1. A line that ends like a label ("Phone:", "Cause No.") and nothing else: pull in text from elsewhere that sits on the same row, to its right.
  for (const L of lines) {
    if (!L.items.length || !/(?::|\b(?:no|number|#)\.?)$/i.test(L.items.map((i) => i.str).join(" ").trim())) continue;
    const row = L.items[0].y, end = Math.max(...L.items.map((i) => i.x + i.w));
    for (const M of lines) {
      if (M === L) continue;
      const take = M.items.filter((i) => i.str.trim() && sameRow(i, row) && i.x >= end - 1).sort((a, b) => a.x - b.x);
      if (!take.length) continue;
      M.items = M.items.filter((i) => !take.includes(i));
      L.items.push(...take);
      changed = true;
    }
  }

  // 2. Fillable fields: put each one on the line it sits on, in left-to-right order, or on a new line below the nearest text above it.
  const placed = widgets.filter(Boolean).sort((a, b) => b.y - a.y || a.x - b.x);
  for (const w of placed) {
    // Many forms print their own box (☐) next to the field. Show the field's state in place of it, once.
    if (w.box && swapPrintedBox(lines, w)) { changed = true; continue; }
    const home = lines.find((L) => L.items.some((i) => sameRow(i, w.y)));
    if (home) {
      const at = home.items.findIndex((i) => i.x > w.x + 1);
      if (at < 0) home.items.push(w); else home.items.splice(at, 0, w);
    } else {
      let idx = -1, best = Infinity;
      lines.forEach((L, k) => { const d = (L.items[0] ? L.items[0].y : -Infinity) - w.y; if (d >= 0 && d < best) { best = d; idx = k; } });
      lines.splice(idx + 1, 0, { items: [w] });
    }
    changed = true;
  }

  if (!changed) return plainText(tcItems);
  return lines.filter((L) => L.items.length).map((L) => L.items.map((i) => i.str).join(" ")).join("\n") + "\n";
}

const fail = (code) => Object.assign(new Error(code), { code });

// Returns { text, pages, pagesRead, fields }. Throws an error with code "locked" (password) or "xfa" (an
// older interactive form type pdf.js cannot read). An empty `text` means the PDF is a picture (a scan).
export async function extractPdfText(lib, data, { maxPages = 40, docOptions = {} } = {}) {
  let pdf;
  try {
    pdf = await lib.getDocument({ data, ...docOptions, isEvalSupported: false }).promise; // eval off, always: see README, Security notes
  } catch (e) {
    if (e && e.name === "PasswordException") throw fail("locked");
    throw e;
  }
  const pagesRead = Math.min(pdf.numPages, maxPages);
  const out = [];
  let fields = 0;
  for (let i = 1; i <= pagesRead; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const widgets = (await page.getAnnotations({ intent: "display" })).map(widgetItem).filter(Boolean);
    fields += widgets.length;
    out.push(assemblePage(tc.items, widgets));
  }
  const text = out.join("\n\n");
  if (!text.replace(/\s/g, "").length && pdf.isPureXfa) throw fail("xfa");
  return { text, pages: pdf.numPages, pagesRead, fields };
}
