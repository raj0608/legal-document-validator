// The court staff pages' shared state: this morning's hearing board and the 90-day pauses, the same on every staff screen.
// In memory only, and made inside createApp: it starts from the docket (made-up cases) and is gone when the server stops.
// Every change goes through the same functions the page uses, in shared/court/, then reaches every open staff screen.
import { ApiError } from "../errors.js";
import { applyAction } from "../../shared/court/hearing-board.js";
import { applyPauseAction, applyAidUpdate, pauseFromHearing } from "../../shared/court/pause-case.js";
import { toISO } from "../../shared/dates/date-math.js";

export function createLiveCourt({ docket, now = Date.now }) {
  const today = () => toISO(new Date(now()));
  const watchers = new Set();
  let day = "", board = [], pauses = [];

  function start() { day = today(); board = docket.morning(day, now()); pauses = docket.pauses(day, now()); }
  // A new day brings a new morning docket. The paused cases carry on.
  function freshDay() { if (day !== today()) { day = today(); board = docket.morning(day, now()); } }
  start();

  const snapshot = () => { freshDay(); return { day, now: now(), board, pauses }; };
  const publish = () => { const s = snapshot(); for (const fn of watchers) fn(s); return s; };

  // One change from shared/court/ on one case. A change the case cannot take is a bad request; an unknown case is not found.
  function change(list, id, fn) {
    const i = list.findIndex((x) => x.id === id);
    if (i < 0) throw new ApiError("not_found", 404);
    let next;
    try { next = fn(list[i]); } catch (e) { if (e && e.message === "bad_action") throw new ApiError("bad_request", 400); throw e; }
    return { list: list.map((x, k) => (k === i ? next : x)), next };
  }

  return {
    snapshot,
    watch(fn) { watchers.add(fn); return () => watchers.delete(fn); },
    watching: () => watchers.size,
    reset() { start(); return publish(); },
    boardAction(id, action) {
      freshDay();
      const r = change(board, id, (c) => applyAction(c, action, now()));
      board = r.list;
      // The judge paused the case for 90 days: it joins the paused cases, once.
      if (r.next.outcome === "diversion" && !pauses.some((p) => p.cause === r.next.cause)) pauses = [pauseFromHearing(r.next, day, docket.agency), ...pauses];
      return publish();
    },
    pauseAction(id, action) {
      freshDay();
      pauses = change(pauses, id, (p) => applyPauseAction(p, action, day)).list;
      return publish();
    },
    aidUpdate(id, update) {
      freshDay();
      pauses = change(pauses, id, (p) => applyAidUpdate(p, update, now())).list;
      return publish();
    }
  };
}
