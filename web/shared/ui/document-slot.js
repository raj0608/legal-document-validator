// Loading a paper (PDF, pasted text or a sample), protecting it, and showing the privacy summary.
// The same loader serves three slots: papers, form and clerk.
import { $, el } from "/web/shared/lib/dom.js";
import { t, locale } from "/web/shared/lib/page-text.js";
import { state } from "/web/shared/state.js";
import { protect } from "/shared/safety/protect.js";
import { parseExtraNames } from "/shared/safety/redaction.js";
import { readPdf } from "/web/shared/lib/read-pdf.js";

const hooks = {};
export const registerSlot = (slot, h) => { hooks[slot] = h; };
export const currentExtraNames = () => parseExtraNames($("extraNames").value);

const loaders = {};
export function makeLoader(slot, samples) {
  const root = $(slot + "Loader");
  const row = el("div", "loader");
  const lab = el("label", "btn primary file-btn");
  const input = el("input", "sr"); input.type = "file"; input.accept = "application/pdf,.pdf";
  const sp = el("span"); sp.dataset.i18n = "upload_btn";
  lab.append(input, sp);
  row.appendChild(lab);
  samples.forEach((s) => {
    const b = el("button", "btn"); b.type = "button"; b.dataset.i18n = s.btn;
    b.addEventListener("click", () => loadDoc(slot, { nameKey: s.name, text: s.text, meta: () => t("page") }));
    row.appendChild(b);
  });
  const pb = el("button", "btn ghost"); pb.type = "button"; pb.dataset.i18n = "paste_btn";
  row.appendChild(pb);
  const box = el("div", "paste"); box.hidden = true;
  const ta = el("textarea"); ta.rows = 6; ta.dataset.i18nPh = "paste_ph"; ta.setAttribute("aria-label", "Paste text");
  const use = el("button", "btn"); use.type = "button"; use.dataset.i18n = "paste_use";
  const useWrap = el("div"); useWrap.appendChild(use);
  box.append(ta, useWrap);
  const status = el("div", "status"); status.hidden = true; status.setAttribute("role", "status");
  const setStatus = (m) => { status.textContent = m || ""; status.hidden = !m; };
  pb.addEventListener("click", () => { box.hidden = !box.hidden; if (!box.hidden) ta.focus(); });
  use.addEventListener("click", () => {
    const v = ta.value.trim();
    if (!v) return;
    box.hidden = true;
    loadDoc(slot, { nameKey: "pasted_name", text: v, meta: () => t("chars", { n: v.length.toLocaleString(locale()) }) });
  });
  input.addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") { setStatus(t("doc_notpdf")); return; }
    setStatus(t("reading"));
    try {
      const { text, pages, pagesRead } = await readPdf(f);
      if (!text.replace(/\s/g, "").length) { setStatus(t("doc_scan")); return; }
      setStatus("");
      const meta = () => (pagesRead < pages ? t("pages_partial", { n: pagesRead, total: pages }) : pages === 1 ? t("page") : t("pages", { n: pages }));
      loadDoc(slot, { name: f.name, text, meta });
    } catch (err) {
      if (err && err.code === "locked") setStatus(t("doc_locked"));
      else if (err && err.code === "xfa") setStatus(t("doc_xfa"));
      else { console.error(err); setStatus(t("doc_error")); }
    } finally { input.value = ""; } // so the same file can be chosen again
  });
  root.append(row, box, status);
  loaders[slot] = { reset() { ta.value = ""; box.hidden = true; setStatus(""); } };
}

export function loadDoc(slot, src) {
  const p = protect(src.text, { extraNames: currentExtraNames() });
  state[slot] = Object.assign(p, { name: src.name || "", nameKey: src.nameKey || "", meta: src.meta });
  if (hooks[slot] && hooks[slot].onLoad) hooks[slot].onLoad();
  renderDoc(slot);
}

export function removeDoc(slot) {
  state[slot] = null;
  if (loaders[slot]) loaders[slot].reset();
  if (hooks[slot] && hooks[slot].onRemove) hooks[slot].onRemove();
  renderDoc(slot);
}

// Names added on the Privacy tab apply to papers that are already loaded. The paper's token numbers stay
// the same, so earlier chat messages still restore correctly. A name once hidden stays hidden for this visit.
export function reprotectAll() {
  ["papers", "form", "clerk"].forEach((slot) => {
    const d = state[slot];
    if (!d) return;
    const p = protect(d.raw, { extraNames: currentExtraNames(), tokens: d.tokens });
    Object.assign(d, { safe: p.safe, back: p.back, counts: p.counts, removed: p.removed });
    renderDoc(slot);
  });
}

export function renderDoc(slot) {
  const root = $(slot + "Doc");
  root.textContent = "";
  const d = state[slot];
  if (slot === "papers") $("explainWrap").hidden = !d;
  if (!d) return;
  const card = el("div", "doc");
  const row = el("div", "doc-row");
  const info = el("div");
  info.append(el("div", "doc-name", d.nameKey ? t(d.nameKey) : d.name), el("div", "doc-meta", d.meta()));
  const rm = el("button", "link-btn", t("remove_doc")); rm.type = "button";
  rm.addEventListener("click", () => removeDoc(slot));
  row.append(info, rm);
  card.appendChild(row);
  if (d.truncated) card.appendChild(el("p", "warn", t("doc_truncated")));
  // privacy and safety summary
  const total = Object.values(d.counts).reduce((a, b) => a + b, 0);
  const sh = el("div", "shield");
  sh.appendChild(el("strong", null, t("shield_h")));
  sh.appendChild(el("span", null, t("shield_sum", { n: total, m: d.removed })));
  const kinds = Object.entries(d.counts).map(([k, v]) => t("k_" + k) + ": " + v).join(", ");
  if (kinds) sh.appendChild(el("span", "ctx", kinds));
  sh.appendChild(el("span", "ctx", t("shield_note")));
  const det = el("details");
  det.appendChild(el("summary", null, t("shield_see")));
  det.appendChild(el("pre", null, d.safe));
  sh.appendChild(det);
  card.appendChild(sh);
  root.appendChild(card);
}
