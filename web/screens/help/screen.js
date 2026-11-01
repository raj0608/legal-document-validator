// "Questions" (FAQ): the common questions, with their sources.
import { $, el } from "/web/shared/lib/dom.js";
import { t } from "/web/shared/lib/page-text.js";
import { state, TR } from "/web/shared/state.js";
import { FAQ } from "/shared/i18n/faq.js";
import { SRC } from "/shared/i18n/sources.js";

export function renderFaq() {
  const box = $("faq");
  box.textContent = "";
  FAQ.forEach((f, i) => {
    let q = f.q.en, a = f.a.en;
    if (state.lang === "es") { q = f.q.es; a = f.a.es; }
    else if (state.lang !== "en" && TR[state.lang] && TR[state.lang].faq[i]) { q = TR[state.lang].faq[i].q; a = TR[state.lang].faq[i].a; }
    const d = el("details", "faq");
    d.appendChild(el("summary", null, q));
    const ans = el("div", "ans");
    ans.appendChild(el("p", null, a));
    const src = el("p", "srcs");
    src.append(t("sources") + ": ");
    f.src.forEach((k, j) => {
      const l = el("a", null, SRC[k].label); l.href = SRC[k].url; l.target = "_blank"; l.rel = "noopener";
      src.appendChild(l);
      if (j < f.src.length - 1) src.append("; ");
    });
    ans.appendChild(src);
    d.appendChild(ans);
    box.appendChild(d);
  });
}
