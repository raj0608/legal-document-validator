// The board: who is before the judge now and who is next in line, then one lane for each stage.
// Each case is a card that opens its controls.
import { $, el } from "/app/shared/lib/dom.js";
import { t } from "/app/shared/lib/page-text.js";
import { state } from "/app/shared/state.js";
import { courtNow } from "/app/shared/api/court-feed.js";
import { LANES, PARTIES, laneCases, beforeJudge, nextInLine, waitedMinutes } from "/shared/court/hearing-board.js";
import { laneName, withName, outcomeName, partyName, names } from "/app/court/hearings/lib/board-words.js";

// Who has checked in: a mark for each side, with the words a screen reader needs.
function whoMarks(c) {
  const box = el("span", "case-who");
  for (const p of PARTIES) {
    const here = c[p + "Here"];
    const mark = el("span", "who" + (here ? " in" : ""), partyName(p));
    mark.appendChild(el("span", "sr", " " + (here ? t("who_here") : t("who_not_here"))));
    box.appendChild(mark);
  }
  return box;
}

// The one line that says where a case is, with how long it has been there.
function infoLine(c, place, now) {
  const bits = [];
  if (c.stage === "talking") bits.push(withName(c.with));
  if (c.stage === "ready") bits.push(t("in_line", { n: place }));
  if (c.stage === "done") bits.push(outcomeName(c.outcome));
  else bits.push(t("waited", { n: waitedMinutes(c, now) }));
  return bits.join(" · ");
}

function card(c, now, place) {
  const b = el("button", "case-card stage-" + c.stage);
  b.type = "button";
  b.dataset.open = c.id;
  b.dataset.key = "card-" + c.id;
  b.append(el("span", "case-cause", c.cause), el("span", "case-names", names(c)), el("span", "case-info", infoLine(c, place, now)));
  if (c.stage === "done" && c.outcome === "dismissed") b.appendChild(el("span", "case-seal", t("seal_short")));
  if (c.stage !== "done") b.appendChild(whoMarks(c));
  return b;
}

function caseButton(label, c, cls, data) {
  const b = el("button", "btn" + (cls ? " " + cls : ""), label);
  b.type = "button";
  Object.assign(b.dataset, data);
  return b;
}

// Two halves side by side: the case before the judge, and the next one in line.
export function drawNow() {
  const box = $("boardNow");
  box.textContent = "";
  const s = state.court;
  if (!s) return;
  const now = el("div", "now-col");
  now.appendChild(el("h2", "now-h", t("now_h")));
  const before = beforeJudge(s.board);
  if (!before.length) now.appendChild(el("p", "now-none", t("now_none")));
  for (const c of before) {
    now.append(el("p", "now-names", names(c)), el("p", "case-cause", c.cause),
      caseButton(t("now_open"), c, "primary", { open: c.id, key: "now-" + c.id }));
  }
  const next = el("div", "now-col next");
  next.appendChild(el("h2", "now-h", t("now_next_h")));
  const n = nextInLine(s.board);
  if (!n) next.appendChild(el("p", "now-none", t("now_next_none")));
  else next.append(el("p", "now-names", names(n)), el("p", "case-cause", n.cause), caseButton(t("act_call"), n, "", { id: n.id, act: "call", key: "call-next" }));
  box.append(now, next);
}

export function drawLanes() {
  const box = $("boardLanes");
  box.textContent = "";
  const s = state.court;
  if (!s) return;
  const now = courtNow();
  for (const lane of LANES) {
    const list = laneCases(s.board, lane);
    const sec = el("section", "lane lane-" + lane);
    const h = el("h2", "lane-h");
    h.append(el("span", null, laneName(lane)), el("span", "lane-n", String(list.length)));
    sec.appendChild(h);
    if (!list.length) sec.appendChild(el("p", "lane-empty", t("lane_empty")));
    const ul = el("ul", "lane-list");
    list.forEach((c, i) => { const li = el("li"); li.appendChild(card(c, now, i + 1)); ul.appendChild(li); });
    if (list.length) sec.appendChild(ul);
    box.appendChild(sec);
  }
}
