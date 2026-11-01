// "Check my form": the checklist for a filled-in form, and the reader for a clerk's notice.
import { $, el, t, state, fmtDate, inlineHtml } from "/web/js/core.js";
import { formType, checkForm } from "/shared/analysis/form-checklist.js";
import { findDeadline } from "/shared/analysis/fix-by-date.js";
import { toISO, fromISO, dayDiff } from "/shared/dates/date-math.js";
import { unredact } from "/shared/safety/redaction.js";
import { SRC } from "/shared/i18n/sources.js";
import { ai, PERMANENT, errCopy, disableAi, addAdviceFlag, addDateFlag } from "/web/js/ai.js";
import * as api from "/web/js/api-client.js";
import { registerSlot } from "/web/js/docs.js";
import { renderDates } from "/web/screens/dates/screen.js";

// ---------- Form checklist (no AI) ----------
export function renderChecks() {
  const d = state.form;
  $("formOut").hidden = !d;
  if (!d) return;
  $("formType").textContent = t("form_type", { x: t(formType(d.raw)) });
  const ul = $("checks");
  ul.textContent = "";
  const hearing = fromISO(state.dates.hearing);
  checkForm(d.raw, { hearingDays: hearing ? dayDiff(hearing) : null }).forEach((c) => {
    const li = el("li");
    const head = el("div");
    head.appendChild(el("span", "lbl", t(c.lbl)));
    const stKey = { ok: "st_ok", miss: "st_miss", unclear: "st_unclear", info: "st_info" }[c.st];
    head.appendChild(el("span", "st " + (c.st === "info" ? "unclear" : c.st), t(stKey)));
    li.appendChild(head);
    li.appendChild(el("span", "ctx", t(c.detailKey, c.vars)));
    if (c.snips && c.snips.length) {
      const sn = el("ul", "snips");
      c.snips.forEach((s) => sn.appendChild(el("li", null, s)));
      li.appendChild(sn);
    }
    if (c.src) { const a = el("a", null, c.src.label); a.href = c.src.url; a.target = "_blank"; a.rel = "noopener"; li.appendChild(a); }
    ul.appendChild(li);
  });
}

// ---------- Clerk notice: fix-by date (no AI) ----------
export function renderCure() {
  const d = state.clerk;
  $("clerkOut").hidden = !d;
  if (!d) return;
  const card = $("cureCard");
  card.textContent = "";
  const dl = findDeadline(d.raw);
  card.appendChild(el("div", "label", t("fixby")));
  if (dl && dl.date) {
    const big = el("div", "big");
    big.appendChild(el("mark", null, fmtDate(dl.date)));
    card.appendChild(big);
    if (dl.quote) card.appendChild(el("div", "sub", t("deadline_quote") + " “" + dl.quote + "”"));
    card.appendChild(el("p", "small", t("fixby_hol")));
    if (dl.skipped && dl.skipped.length) card.appendChild(el("p", "small", t("fixby_skipped", { x: dl.skipped.map((h) => fmtDate(h.date) + " (" + t("hol_" + h.id) + ")").join("; ") })));
    if (state.dates.cure !== toISO(dl.date)) { state.dates.cure = toISO(dl.date); renderDates(); }
  } else {
    card.appendChild(el("p", null, t("fixby_none")));
  }
  const note = el("p", "small", t("fixby_note") + " ");
  const a = el("a", null, SRC.tr88.label); a.href = SRC.tr88.url; a.target = "_blank"; a.rel = "noopener";
  note.appendChild(a);
  for (const k of ["tr6", "holidays"]) {
    const l = el("a", null, SRC[k].label); l.href = SRC[k].url; l.target = "_blank"; l.rel = "noopener";
    note.append("; ", l);
  }
  card.appendChild(note);
}

registerSlot("form", {
  onLoad() { $("blanksOut").textContent = ""; renderChecks(); },
  onRemove() { $("formOut").hidden = true; $("blanksOut").textContent = ""; }
});
registerSlot("clerk", {
  onLoad() { $("clerkAi").textContent = ""; renderCure(); },
  onRemove() { $("clerkOut").hidden = true; $("clerkAi").textContent = ""; if (state.dates.cure) { state.dates.cure = ""; renderDates(); } }
});

// A card with a "reading…" line. `run` fills it; shared error handling lives here.
async function aiCard({ btnId, outId, heading, run }) {
  if (!ai.on) return;
  const out = $(outId);
  out.textContent = "";
  const card = el("div", "card");
  card.appendChild(el("h3", null, t(heading)));
  const body = el("div");
  body.appendChild(el("p", "thinking", t("thinking")));
  card.appendChild(body);
  out.appendChild(card);
  const btn = $(btnId);
  btn.disabled = true;
  try { await run(card, body); }
  catch (e) {
    if (e && PERMANENT.includes(e.code)) { out.textContent = ""; disableAi(); }
    else if (e && e.code !== "cancelled") { body.textContent = ""; card.appendChild(el("p", "warn", errCopy(e && e.code))); }
  } finally { if (ai.on) btn.disabled = false; }
}

function blanks() {
  const d = state.form;
  if (!d) return;
  return aiCard({
    btnId: "blanksBtn", outId: "blanksOut", heading: "blanks_h",
    async run(card, body) {
      const data = await api.json("blanks", { lang: state.lang, doc: { safe: d.safe } });
      const items = data && Array.isArray(data.items) ? data.items.filter((x) => x && typeof x.label === "string" && typeof x.asks === "string") : [];
      body.textContent = "";
      if (!items.length) body.appendChild(el("p", null, t("blanks_none")));
      const ul = el("ul");
      items.forEach((x) => {
        const li = el("li");
        li.appendChild(el("strong", null, unredact(x.label, d.back)));
        const asks = el("span"); asks.innerHTML = inlineHtml(x.asks, d.back);
        li.append(" ", asks);
        ul.appendChild(li);
      });
      body.appendChild(ul);
      body.lang = state.lang;
      addAdviceFlag(card, items.map((x) => x.asks).join(" "));
      addDateFlag(card, items.map((x) => x.asks).join(" "), d.raw);
    }
  });
}

function clerkNotice() {
  const d = state.clerk;
  if (!d) return;
  return aiCard({
    btnId: "clerkBtn", outId: "clerkAi", heading: "clerk_h",
    async run(card, body) {
      const data = await api.json("clerk", { lang: state.lang, doc: { safe: d.safe } });
      body.textContent = "";
      if (data && typeof data.summary === "string") { const p = el("p"); p.innerHTML = inlineHtml(data.summary, d.back); body.appendChild(p); }
      const items = data && Array.isArray(data.items) ? data.items.filter((x) => x && typeof x.quote === "string" && typeof x.plain === "string") : [];
      if (items.length) {
        body.appendChild(el("h3", null, t("clerk_items_h")));
        const ul = el("ul", "checks");
        items.forEach((x, i) => {
          const li = el("li");
          const lab = el("label");
          const cb = el("input"); cb.type = "checkbox"; cb.id = "fix" + i;
          lab.htmlFor = cb.id;
          lab.appendChild(el("span", "lbl", " “" + unredact(x.quote, d.back) + "”"));
          const plain = el("span", "ctx"); plain.innerHTML = inlineHtml(x.plain, d.back);
          li.append(cb, lab, plain);
          ul.appendChild(li);
        });
        body.appendChild(ul);
      }
      body.lang = state.lang;
      addAdviceFlag(card, (data && data.summary ? data.summary : "") + " " + items.map((x) => x.plain).join(" "));
      addDateFlag(card, (data && data.summary ? data.summary : "") + " " + items.map((x) => x.plain).join(" "), d.raw);
    }
  });
}

export function setMode(m) {
  $("modeForm").setAttribute("aria-pressed", String(m === "form"));
  $("modeClerk").setAttribute("aria-pressed", String(m === "clerk"));
  $("formPanel").hidden = m !== "form";
  $("clerkPanel").hidden = m !== "clerk";
}

export function initCheck() {
  $("blanksBtn").addEventListener("click", blanks);
  $("clerkBtn").addEventListener("click", clerkNotice);
  $("recheckBtn").addEventListener("click", () => { setMode("form"); window.scrollTo(0, 0); });
  $("modeForm").addEventListener("click", () => setMode("form"));
  $("modeClerk").addEventListener("click", () => setMode("clerk"));
}
