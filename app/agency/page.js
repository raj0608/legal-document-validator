// Rental-aid updates (#agency): an agency working with the court posts where a tenant's rental aid stands, and the
// clerk sees it right away on 90-day pauses. Order 22S-MS-308 lets courts share these otherwise confidential records
// with rental-assistance providers. A real version would show each agency only the cases referred to it.
import { $, el } from "/app/shared/lib/dom.js";
import { t } from "/app/shared/lib/page-text.js";
import { state } from "/app/shared/state.js";
import { courtChange } from "/app/shared/api/client.js";
import { onCourtChange, setCourt } from "/app/shared/api/court-feed.js";
import { toast } from "/app/shared/ui/toast.js";
import { fmtShort } from "/app/shared/lib/date-format.js";
import { aidSummary } from "/app/shared/lib/aid-words.js";
import { fromISO } from "/shared/dates/date-math.js";
import { AMOUNT_MAX } from "/shared/court/pause-case.js";

let listed = ""; // which cases the form lists, so a live update does not rebuild it under the person's hands

const paused = () => (state.court ? state.court.pauses.filter((p) => p.state === "paused") : []);
const withAmount = () => ["approved", "paid"].includes($("aidStatus").value);
const names = (p) => p.landlord + " v. " + p.tenant;

function drawChoices(list) {
  const key = list.map((p) => p.id).join(" ");
  if (key === listed) return;
  listed = key;
  const sel = $("aidCase");
  const keep = sel.value;
  sel.textContent = "";
  for (const p of list) { const o = el("option", null, names(p) + " (" + p.cause + ")"); o.value = p.id; sel.appendChild(o); }
  if (list.some((p) => p.id === keep)) sel.value = keep;
}

function drawList(list) {
  const ul = $("agencyList");
  ul.textContent = "";
  if (!list.length) ul.appendChild(el("li", "lane-empty", t("agency_none")));
  for (const p of list) {
    const li = el("li", "pause");
    li.appendChild(el("h3", null, names(p)));
    li.appendChild(el("p", "pause-meta", p.cause + " · " + t("paused_on", { date: fmtShort(fromISO(p.start)) })));
    const aid = el("p", "aid-line");
    aid.appendChild(el("strong", null, aidSummary(p.aid)));
    if (p.aid) aid.appendChild(el("span", "aid-when", t("aid_by", { agency: p.aid.by, date: fmtShort(new Date(p.aid.at)) })));
    li.appendChild(aid);
    ul.appendChild(li);
  }
}

export function renderAgency() {
  const list = paused();
  $("agencyDown").hidden = !state.courtDown;
  $("aidAmountField").hidden = !withAmount();
  $("aidSend").disabled = !list.length;
  $("agencyAs").textContent = list.length ? t("agency_as", { agency: list[0].agency }) : "";
  drawChoices(list);
  drawList(list);
}

async function send() {
  const id = $("aidCase").value;
  if (!id) return;
  const update = { status: $("aidStatus").value, note: $("aidNote").value.trim() };
  if (withAmount()) {
    const n = Number($("aidAmount").value);
    if (!Number.isInteger(n) || n < 1 || n > AMOUNT_MAX) { toast(t("agency_amount_needed")); $("aidAmount").focus(); return; }
    update.amount = n;
  }
  $("aidSend").disabled = true;
  try {
    setCourt(await courtChange("pauses/" + id + "/aid", { update }));
    $("aidNote").value = "";
    $("aidAmount").value = "";
    toast(t("agency_sent"));
  } catch (e) { toast(e && e.code === "bad_request" ? t("live_conflict") : t("live_error")); }
  $("aidSend").disabled = !paused().length;
}

export function initAgency() {
  onCourtChange(renderAgency);
  $("aidStatus").addEventListener("change", () => { $("aidAmountField").hidden = !withAmount(); });
  $("aidSend").addEventListener("click", send);
}
