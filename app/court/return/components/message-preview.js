// The preview of the message, exactly as the server wrote it. Nothing is sent: this only shows it.
import { $, el } from "/app/shared/lib/dom.js";
import { t } from "/app/shared/lib/page-text.js";
import { fmtDate } from "/app/shared/lib/date-format.js";
import { fromISO } from "/shared/dates/date-math.js";

// `m` is what the server returned: { channel, to, subject, body, fixBy, parts }, or null to hide the preview.
export function renderPreview(m) {
  $("retOut").hidden = !m;
  if (!m) { $("retMeta").textContent = ""; $("retBody").textContent = ""; return; }
  const meta = $("retMeta");
  meta.textContent = "";
  const row = (label, value) => { const p = el("p"); p.append(el("strong", null, label + ": "), value); meta.appendChild(p); };
  row(t("ret_to"), m.to);
  if (m.subject) row(t("ret_subject"), m.subject);
  row(t("ret_fixby"), fmtDate(fromISO(m.fixBy)));
  if (m.parts) meta.appendChild(el("p", "ctx", m.parts === 1 ? t("ret_parts_one") : t("ret_parts_many", { n: m.parts })));
  $("retBody").textContent = m.body;
}
