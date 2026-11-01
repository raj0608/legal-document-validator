// Builds the PDF fixtures used by tests/shared/pdf-text.test.js. Run: node tests/fixtures/make-fixtures.mjs
// All content is fictional. The PDFs are committed, so this only needs re-running to change them.
import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { SAMPLE, CLERK_SAMPLE } from "../../shared/sample-papers.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = (name, bytes) => { fs.writeFileSync(path.join(here, name), bytes); console.log(name, bytes.length + " bytes"); };
const ascii = (s) => s.replace(/[’‘]/g, "'").replace(/[“”]/g, '"');

// ---------- Plain text, several lines per page ----------
async function textPdf(text, perPage = 22) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const lines = ascii(text).split("\n");
  for (let i = 0; i < lines.length; i += perPage) {
    const page = doc.addPage([612, 792]);
    lines.slice(i, i + perPage).forEach((line, k) => page.drawText(line, { x: 54, y: 740 - k * 30, size: 10, font, maxWidth: 500 }));
  }
  return doc.save();
}

// ---------- A court form with fillable fields ----------
async function formPdf({ filled, flatten }) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([612, 792]);
  const form = doc.getForm();
  const text = (s, x, y, f = font, size = 11) => page.drawText(s, { x, y, size, font: f });
  const field = (name, x, y, w, value) => {
    const tf = form.createTextField(name);
    tf.addToPage(page, { x, y: y - 4, width: w, height: 18, font, borderWidth: 0.5, borderColor: rgb(0.5, 0.5, 0.5) });
    if (filled && value) tf.setText(value);
    return tf;
  };
  const box = (name, x, y, checked) => {
    const cb = form.createCheckBox(name);
    cb.addToPage(page, { x, y: y - 3, width: 12, height: 12, borderWidth: 0.5 });
    if (filled && checked) cb.check();
  };

  text("STATE OF INDIANA, COUNTY OF ALLEN", 54, 740);
  text("IN THE ALLEN SUPERIOR COURT, SMALL CLAIMS DIVISION", 54, 724);
  text("Cause No.", 54, 696);
  field("cause", 120, 696, 200, "02D00-2611-SC-000000");
  text("Maple Row Apartments LLC, Plaintiff,", 54, 660);
  text("v.", 54, 644);
  text("Kimi Sample, Defendant.", 54, 628);
  text("MOTION FOR CONTINUANCE", 54, 590, bold, 13);
  text("The Defendant asks the Court to reschedule the hearing set for November 24, 2026.", 54, 560);
  text("The reason for this request is:", 54, 536);
  field("reason", 54, 512, 480, "I have a medical appointment that day.");
  box("contacted", 54, 480, false);
  text("I have contacted the other party about this request.", 74, 480);
  box("notContacted", 54, 460, true);
  text("I have not contacted the other party.", 74, 460);
  text("Signature:", 54, 410);
  field("signature", 140, 410, 220, "/s/ Kimi Sample");
  text("Printed name:", 54, 386);
  field("printedName", 140, 386, 220, "Kimi Sample");
  text("Mailing address:", 54, 362);
  field("address", 140, 362, 380, "123 Example Street, Apt. 4, Fort Wayne, IN 46802");
  text("Phone:", 54, 338);
  field("phone", 140, 338, 220, "(260) 555-0147");
  text("Email (if any):", 54, 314);
  field("email", 140, 314, 220, "none");
  text("Date:", 54, 290);
  field("date", 140, 290, 220, "November 10, 2026");
  text("CERTIFICATE OF SERVICE", 54, 240, bold);
  text("I certify that a copy of this motion was mailed to the plaintiff on the date above.", 54, 222);

  if (flatten) form.flatten();
  return doc.save();
}

// ---------- A page that is only a picture (no text), like a scan ----------
function png(w, h) {
  const crc = (buf) => { let c, crcv = ~0; for (const b of buf) { c = (crcv ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcv = (crcv >>> 8) ^ c; } return ~crcv >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3);
    for (let x = 0; x < w; x++) { const v = (y % 12 < 3 && x > 20 && x < w - 20) ? 40 : 245; row[1 + x * 3] = row[2 + x * 3] = row[3 + x * 3] = v; }
    rows.push(row);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(Buffer.concat(rows))), chunk("IEND", Buffer.alloc(0))]);
}
async function scannedPdf() {
  const doc = await PDFDocument.create();
  const img = await doc.embedPng(png(300, 400));
  doc.addPage([612, 792]).drawImage(img, { x: 54, y: 54, width: 504, height: 672 });
  return doc.save();
}

async function longPdf(n) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= n; i++) doc.addPage([612, 792]).drawText("Page " + i + " of " + n + ". This is filler text for a long fictional paper.", { x: 54, y: 740, size: 11, font });
  return doc.save();
}

out("notice-text.pdf", await textPdf(SAMPLE));
out("clerk-notice-text.pdf", await textPdf(CLERK_SAMPLE));
out("form-fillable-empty.pdf", await formPdf({ filled: false, flatten: false }));
out("form-fillable-filled.pdf", await formPdf({ filled: true, flatten: false }));
out("form-flattened.pdf", await formPdf({ filled: true, flatten: true }));
out("scanned.pdf", await scannedPdf());
out("long-45-pages.pdf", await longPdf(45));
