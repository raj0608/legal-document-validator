// The court staff pages' live state: one connection to the server while a live page shows, closed when the person leaves.
// Each live page asks to be redrawn when the state changes; the state itself is kept in memory, in state.court.
import { state } from "/app/shared/state.js";
import { watchCourt } from "/app/shared/api/client.js";

const LIVE = ["hearings", "diversion", "agency"];
const drawers = [];
let stop = null;

export function onCourtChange(draw) { drawers.push(draw); }
const redraw = () => drawers.forEach((draw) => draw());

// A new state from the server, from the live feed or as the answer to a change made on this screen.
export function setCourt(s) {
  if (!s || !Array.isArray(s.board) || !Array.isArray(s.pauses)) return;
  state.court = s;
  state.courtSkew = s.now - Date.now();
  redraw();
}

// The server's time now, for "waiting 12 min", whatever this computer's clock says.
export const courtNow = () => Date.now() + state.courtSkew;

// Called on every change of screen: open the feed on a live page, close it everywhere else.
export function syncLive(view) {
  if (LIVE.includes(view) && !stop) stop = watchCourt(setCourt, (down) => { state.courtDown = down; redraw(); });
  else if (!LIVE.includes(view) && stop) { stop(); stop = null; }
}
