// The two AI cards on Check my form: what each blank asks for, and what the clerk's notice says.
import { $, el } from "/web/shared/lib/dom.js";
import { t } from "/web/shared/lib/page-text.js";
import { state } from "/web/shared/state.js";
import { inlineHtml } from "/web/shared/lib/answer-html.js";
import { unredact } from "/shared/safety/redaction.js";
import { ai, PERMANENT, errCopy, disableAi } from "/web/shared/ui/ai-helper.js";
import { addAdviceFlag, addDateFlag } from "/web/shared/ui/answer-flags.js";
import * as api from "/web/shared/api/client.js";

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

export function blanks() {
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

export function clerkNotice() {
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
