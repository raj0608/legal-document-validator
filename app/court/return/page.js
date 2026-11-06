// Return a filing for correction: the clerk picks what was wrong and the day it was returned, and the page shows the message the
// filer would get, with the last day to fix it. The email address or phone number is used once, for the preview, and is not saved.
import { $, el } from "/app/shared/lib/dom.js";
import { t } from "/app/shared/lib/page-text.js";
import { state } from "/app/shared/state.js";
import { previewReturnNotice } from "/app/shared/api/client.js";
import { REASON_IDS } from "/shared/notice/return-reasons.js";
import { toISO } from "/shared/dates/date-math.js";
import { renderPreview } from "/app/court/return/components/message-preview.js";

const form = { lang: "en", channel: "email" }; // the two choices; everything else is read from the page when it is needed

function say(msg) { $("retStatus").textContent = msg || ""; $("retStatus").hidden = !msg; }

function setPressed(ids, on) { ids.forEach(([id, v]) => $(id).setAttribute("aria-pressed", String(v === on))); }

// Labels that depend on the page's language or on the channel. The checked boxes are kept.
export function renderReturn() {
  const box = $("retReasons");
  const checked = new Set([...box.querySelectorAll("input:checked")].map((i) => i.value));
  box.textContent = "";
  for (const id of REASON_IDS) {
    const row = el("div", "ret-reason");
    const cb = el("input"); cb.type = "checkbox"; cb.id = "retR_" + id; cb.value = id; cb.checked = checked.has(id);
    const lab = el("label", null, t("ret_r_" + id)); lab.htmlFor = cb.id;
    row.append(cb, lab);
    box.appendChild(row);
  }
  $("retContactLabel").textContent = t(form.channel === "email" ? "ret_to_email" : "ret_to_sms");
  renderPreview(state.returnPreview);
}

function chooseChannel(channel) {
  form.channel = channel;
  setPressed([["retModeEmail", "email"], ["retModeSms", "sms"]], channel);
  const input = $("retContact");
  input.value = ""; // an address typed for one channel is not a number for the other
  input.type = channel === "email" ? "email" : "tel";
  input.inputMode = channel === "email" ? "email" : "tel";
  input.maxLength = channel === "email" ? 254 : 30;
  $("retContactLabel").textContent = t(channel === "email" ? "ret_to_email" : "ret_to_sms");
}

function chooseLang(lang) {
  form.lang = lang;
  setPressed([["retLangEn", "en"], ["retLangEs", "es"]], lang);
}

// Empties the form and the preview, and forgets the address or number. Also run by "Hide this page".
export function clearReturn() {
  state.returnPreview = null;
  chooseLang("en");
  chooseChannel("email");
  $("retReasons").querySelectorAll("input").forEach((i) => { i.checked = false; });
  $("retOther").value = "";
  $("retContact").value = "";
  $("retDate").value = toISO(new Date());
  say("");
  renderPreview(null);
}

function errorText(code) {
  const known = { invalid_contact: "ret_err_contact", invalid_text: "ret_err_text", invalid_date: "ret_err_date", invalid_reason: "ret_err_reason", rate_limited: "err_rate" };
  return t(known[code] || "err_generic");
}

async function preview() {
  const body = {
    lang: form.lang, channel: form.channel, returnedOn: $("retDate").value, other: $("retOther").value, to: $("retContact").value,
    reasons: REASON_IDS.filter((id) => $("retR_" + id).checked)
  };
  $("retBtn").disabled = true;
  say(t("ret_working"));
  state.returnPreview = null;
  renderPreview(null);
  try {
    state.returnPreview = await previewReturnNotice(body);
    say("");
    renderPreview(state.returnPreview);
    $("retOut").scrollIntoView({ block: "start" });
  } catch (e) { say(errorText(e && e.code)); }
  $("retBtn").disabled = false;
}

export function initReturn() {
  $("retDate").value = toISO(new Date());
  $("retModeEmail").addEventListener("click", () => chooseChannel("email"));
  $("retModeSms").addEventListener("click", () => chooseChannel("sms"));
  $("retLangEn").addEventListener("click", () => chooseLang("en"));
  $("retLangEs").addEventListener("click", () => chooseLang("es"));
  $("retBtn").addEventListener("click", preview);
  $("retClear").addEventListener("click", clearReturn);
}
