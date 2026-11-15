// One paused case: its names and record status, its three dates, the rental-aid status from the agency, and the clerk's steps.
import { el } from "/app/shared/lib/dom.js";
import { t } from "/app/shared/lib/page-text.js";
import { fmtShort } from "/app/shared/lib/date-format.js";
import { aidSummary } from "/app/shared/lib/aid-words.js";
import { fromISO } from "/shared/dates/date-math.js";
import { milestones, nextMilestone } from "/shared/court/pause-schedule.js";
import { isConfidential, needsSealing } from "/shared/court/pause-case.js";

export const NEW_FOR_MS = 10 * 60000; // an agency update is marked new for ten minutes
const short = (iso) => fmtShort(fromISO(iso));
const msName = (key) => ({ day30: t("ms_day30"), day60: t("ms_day60"), ends: t("ms_ends") })[key];
const closedName = (p) => (p.state === "lifted" ? t("res_lifted", { date: short(p.closedOn) })
  : p.resolution === "dismissed" ? t("res_dismissed", { date: short(p.closedOn) }) : t("res_agreement", { date: short(p.closedOn) }));

// Where one date stands, in words, and its colour: done, soon (this week), or late.
function msState(m) {
  if (m.done) return [m.done.how === "report" ? t("ms_report") : t("ms_held"), "done"];
  if (m.key === "ends" && m.inDays < 0) return [t("ms_ended"), "done"];
  if (m.inDays < 0) return [t("ms_late", { n: -m.inDays }), "late"];
  if (m.inDays === 0) return [t("ms_today"), "soon"];
  if (m.inDays === 1) return [t("ms_tomorrow"), "soon"];
  return [t("ms_in", { n: m.inDays }), m.inDays <= 7 ? "soon" : ""];
}

function badge(p) {
  if (p.sealed) return el("span", "badge sealed", t("badge_sealed"));
  return isConfidential(p) ? el("span", "badge conf", t("badge_conf")) : el("span", "badge public", t("badge_public"));
}

function aidBlock(p, now) {
  const box = el("div", "aid");
  box.appendChild(el("span", "aid-h", t("aid_h")));
  box.appendChild(el("span", "aid-status", aidSummary(p.aid)));
  if (!p.aid) return box;
  box.appendChild(el("span", "aid-when", t("aid_by", { agency: p.aid.by, date: fmtShort(new Date(p.aid.at)) })));
  if (now - p.aid.at < NEW_FOR_MS) box.appendChild(el("span", "new-badge", t("aid_new")));
  if (p.aid.note) box.appendChild(el("p", "aid-note", p.aid.note));
  return box;
}

function btn(label, act, p, cls) {
  const b = el("button", "btn" + (cls ? " " + cls : ""), label);
  b.type = "button";
  b.dataset.act = act;
  b.dataset.id = p.id;
  b.dataset.key = act + "-" + p.id;
  return b;
}

// A paused case: the next conference, and one way to end the pause (its three choices are in the dialog).
function actions(p, day) {
  const box = el("div", "pause-acts");
  if (p.state === "paused") {
    const row = el("div", "acts-row");
    const next = nextMilestone(p, day);
    if (next && next.key !== "ends") row.append(el("span", "acts-label", msName(next.key)), btn(t("act_held"), "conf:" + next.key + ":held", p, "primary"), btn(t("act_report"), "conf:" + next.key + ":report", p));
    row.appendChild(btn(t("act_end"), "end", p));
    box.appendChild(row);
    return box;
  }
  const row = el("div", "acts-row");
  row.appendChild(btn(t("act_draft"), "draft:" + (p.state === "lifted" ? "lifted" : p.resolution), p));
  if (needsSealing(p)) row.append(btn(t("act_draft_seal"), "draft:seal", p, "primary"), btn(t("act_sealed"), "sealed", p));
  box.appendChild(row);
  return box;
}

export function pauseCard(p, day, now) {
  const li = el("li", "pause" + (p.aid && now - p.aid.at < NEW_FOR_MS ? " fresh" : ""));
  const head = el("div", "pause-head");
  head.append(el("h3", null, p.landlord + " v. " + p.tenant), badge(p));
  li.appendChild(head);
  const meta = [p.cause, t("paused_on", { date: short(p.start) })];
  if (p.closedOn) meta.push(closedName(p));
  li.appendChild(el("p", "pause-meta", meta.join(" · ")));
  if (p.state === "paused") {
    const ol = el("ol", "milestones");
    for (const m of milestones(p, day)) {
      const [words, cls] = msState(m);
      const item = el("li", "ms" + (cls ? " " + cls : ""));
      item.append(el("span", "ms-name", msName(m.key)), el("span", "ms-date", short(m.date)), el("span", "ms-state", words));
      ol.appendChild(item);
    }
    li.appendChild(ol);
  }
  if (needsSealing(p)) li.appendChild(el("p", "seal-flag", t("seal_flag")));
  li.appendChild(aidBlock(p, now));
  li.appendChild(actions(p, day));
  return li;
}
