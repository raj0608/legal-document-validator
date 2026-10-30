// Shared page state and small helpers. State lives in memory only: nothing is written to storage.
import { LANG, I18N } from "/shared/i18n.js";

export const state = {
  lang: "en",
  papers: null, form: null, clerk: null,
  turns: [],
  chatTokens: null, // token state for chat questions when no paper is loaded
  dates: { notice: "", days: 15, served: "", hearing: "", time: "", place: "", cure: "", fromPaper: false },
  rems: { "1w": false, "3d": false, "1d": true, "2h": true, "1h": false },
  lastCure: null
};
export const TR = {}; // machine translations, kept for this visit only

export const $ = (id) => document.getElementById(id);
export const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
export const locale = () => LANG[state.lang].locale;

export function t(key, vars) {
  let s;
  if (state.lang === "en") s = I18N.en[key];
  else if (state.lang === "es") s = I18N.es[key];
  else s = TR[state.lang] && TR[state.lang].ui[key];
  if (s === undefined) s = I18N.en[key];
  if (vars && typeof s === "string") for (const k in vars) s = s.split("{" + k + "}").join(vars[k]);
  return s;
}

let toastTimer;
export function toast(msg) {
  const e = $("toast");
  e.textContent = msg;
  e.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => e.classList.remove("show"), 3200);
}

// ---------- Dates and times, in the reader's language ----------
export function fmtDate(d) { try { return new Intl.DateTimeFormat(locale(), { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(d); } catch (e) { return d.toDateString(); } }
export function fmtShort(d) { try { return new Intl.DateTimeFormat(locale(), { weekday: "short", month: "short", day: "numeric" }).format(d); } catch (e) { return d.toDateString(); } }
export function fmtTime(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  try { return new Intl.DateTimeFormat(locale(), { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, h, m)); } catch (e) { return hhmm; }
}

// ---------- Text rendering (everything is escaped before any HTML is built) ----------
export function escapeHtml(s) { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function inline(s) { return s.replace(/==(.+?)==/g, "<mark>$1</mark>").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"); }
export function mdToHtml(text) {
  let html = "", list = "";
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line), ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      const type = ul ? "ul" : "ol";
      if (list !== type) { if (list) html += "</" + list + ">"; html += "<" + type + ">"; list = type; }
      html += "<li>" + inline(escapeHtml((ul || ol)[1])) + "</li>";
      continue;
    }
    if (list) { html += "</" + list + ">"; list = ""; }
    if (!line.trim()) continue;
    const h = /^#{1,6}\s+(.*)$/.exec(line);
    html += "<p>" + (h ? "<strong>" + inline(escapeHtml(h[1])) + "</strong>" : inline(escapeHtml(line))) + "</p>";
  }
  if (list) html += "</" + list + ">";
  return html;
}

// ---------- Support contact ----------
export const SUPPORT_PHONE = "+1000000000";
export function renderSupport() {
  document.querySelectorAll("[data-support]").forEach((e) => {
    e.textContent = "";
    const parts = t("support_line", { p: "\u0000" }).split("\u0000");
    e.append(parts[0] || "");
    const a = el("a", null, SUPPORT_PHONE);
    a.href = "tel:" + SUPPORT_PHONE;
    e.appendChild(a);
    e.append(parts[1] || "");
  });
}
