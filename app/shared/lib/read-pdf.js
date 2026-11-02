// ---------- PDF reading (in the browser; the file is never uploaded) ----------
// pdf.js comes from this site (/vendor/pdfjs). Typed values in fillable fields are read too; see /shared/pdf-text.js.
import { extractPdfText } from "/shared/pdf-text.js";

const PDF = "/vendor/pdfjs/";
const PDF_OPTIONS = { docOptions: { cMapUrl: PDF + "cmaps/", cMapPacked: true, wasmUrl: PDF + "wasm/", iccUrl: PDF + "iccs/", standardFontDataUrl: PDF + "standard_fonts/" } };
let pdfLib; // loaded the first time a PDF is chosen, so the page opens fast and papers pasted as text never load it
export async function readPdf(file) {
  if (!pdfLib) {
    pdfLib = await import(PDF + "pdf.min.mjs");
    pdfLib.GlobalWorkerOptions.workerSrc = PDF + "pdf.worker.min.mjs";
  }
  return extractPdfText(pdfLib, new Uint8Array(await file.arrayBuffer()), PDF_OPTIONS);
}
