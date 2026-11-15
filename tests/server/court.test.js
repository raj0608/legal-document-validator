// The court staff pages' server side: the live feed, the changes and their checks, the limits, and how a 90-day pause on
// hearing day reaches the paused cases. A fixed clock and the sample docket, so every run sees the same morning.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../../server/http/app.js";
import { createLiveCourt } from "../../server/court/live-court.js";
import { sampleDocket } from "../../server/court/sample-docket.js";
import { open, shutdown } from "./fake-anthropic.js";

after(() => Promise.all([...open].map(shutdown)));

const NOW = new Date(2026, 10, 6, 9, 30).getTime(); // Friday, November 6, 2026, 9:30 in the morning

async function serve({ config = {}, docket = sampleDocket } = {}) {
  const app = createApp({ docket, config: { log: false, now: () => new Date(NOW), ...config } });
  const server = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  open.add(server);
  const base = "http://127.0.0.1:" + server.address().port;
  const post = (path, body) => fetch(base + "/api/court/" + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { base, post };
}

// Reads the live feed until `n` states have arrived, running `during` after the first, then hangs up.
async function states(base, n, during) {
  const ac = new AbortController();
  const res = await fetch(base + "/api/court/live", { signal: ac.signal });
  assert.match(res.headers.get("content-type"), /^text\/event-stream/);
  const reader = res.body.getReader(), decoder = new TextDecoder();
  const got = [];
  let buffer = "", ran = false;
  while (got.length < n) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut;
    while ((cut = buffer.indexOf("\n\n")) >= 0) {
      const m = /^event: state\ndata: (.*)$/s.exec(buffer.slice(0, cut));
      buffer = buffer.slice(cut + 2);
      if (m) got.push(JSON.parse(m[1]));
    }
    if (got.length && !ran && during) { ran = true; await during(); }
  }
  await reader.cancel().catch(() => {});
  ac.abort();
  return got;
}

test("the live feed starts with this morning's made-up docket and the paused cases", async () => {
  const { base } = await serve();
  const [s] = await states(base, 1);
  assert.equal(s.day, "2026-11-06");
  assert.equal(s.board.length, 14);
  assert.ok(s.board.every((c) => /^99D00-\d{4}-EV-\d{6}$/.test(c.cause)), "cause numbers in a county that does not exist");
  assert.equal(s.board.filter((c) => c.stage === "hearing").length, 1);
  assert.equal(s.pauses.length, 7);
  assert.ok(s.pauses.every((p) => p.agency === "Sample Rental Help"));
});

test("a change reaches every open screen, and a 90-day pause on hearing day joins the paused cases once", async () => {
  const { base, post } = await serve();
  const [first, second] = await states(base, 2, async () => {
    assert.equal((await post("board/c3", { action: { type: "outcome", outcome: "diversion" } })).status, 200);
  });
  assert.equal(first.board.find((c) => c.id === "c3").stage, "hearing");
  const c3 = second.board.find((c) => c.id === "c3");
  assert.deepEqual([c3.stage, c3.outcome], ["done", "diversion"]);
  const p = second.pauses.find((x) => x.id === "p-c3");
  assert.deepEqual([p.start, p.state, p.cause], ["2026-11-06", "paused", c3.cause]);
  await post("board/c3", { action: { type: "reopen" } });
  const again = await (await post("board/c3", { action: { type: "outcome", outcome: "diversion" } })).json();
  assert.equal(again.data.pauses.filter((x) => x.cause === c3.cause).length, 1, "reopened and paused again: still one paused case");
});

test("the clerk's step and the agency's update come back as the new state", async () => {
  const { post } = await serve();
  const a = await (await post("pauses/p1/aid", { update: { status: "approved", amount: 1850, note: "Lease received." } })).json();
  assert.deepEqual(a.data.pauses.find((p) => p.id === "p1").aid, { status: "approved", amount: 1850, note: "Lease received.", at: NOW, by: "Sample Rental Help" });
  const b = await (await post("pauses/p2", { action: { type: "conference", which: "day30", how: "held" } })).json();
  assert.deepEqual(b.data.pauses.find((p) => p.id === "p2").day30, { how: "held", on: "2026-11-06" });
  const r = await (await post("reset", {})).json();
  assert.equal(r.data.pauses.find((p) => p.id === "p1").aid.status, "applied", "starting the sample over puts it back");
});

test("changes are checked: unknown cases, unknown fields, long notes and impossible steps are refused", async () => {
  const { post } = await serve();
  const refused = [
    ["board/zz9", { action: { type: "call" } }, 404, "not_found"],
    ["board/..%2Fc1", { action: { type: "call" } }, 404, "not_found"],
    ["board/c11", { action: { type: "ready" } }, 400, "bad_request"], // nobody is here yet
    ["board/c11", { action: { type: "call", extra: 1 } }, 400, "bad_request"], // a field nobody asked for
    ["board/c11", { action: "call" }, 400, "bad_request"],
    ["board/c11", {}, 400, "bad_request"],
    ["pauses/p1/aid", { update: { status: "applied", note: "x".repeat(201) } }, 400, "bad_request"],
    ["pauses/p1/aid", { update: { status: "paid", amount: "2400" } }, 400, "bad_request"],
    ["pauses/p1", { action: { type: "conference", which: "day30", how: { $ne: "" } } }, 400, "bad_request"],
    ["pauses/p7", { action: { type: "dismiss" } }, 400, "bad_request"] // p7's pause was already lifted
  ];
  for (const [path, body, status, code] of refused) {
    const r = await post(path, body);
    assert.equal(r.status, status, path + " " + JSON.stringify(body).slice(0, 80));
    assert.equal((await r.json()).error.code, code);
  }
});

test("the staff routes have their own per-minute limit, so a busy board never uses up the AI's", async () => {
  const { base, post } = await serve({ config: { rateLimitPerMin: 5 } });
  for (let i = 0; i < 12; i++) assert.equal((await post("board/c3", { action: { type: "advised", value: i % 2 === 0 } })).status, 200);
  assert.equal((await fetch(base + "/api/nothing-here")).status, 404, "the AI's limit of 5 a minute is untouched");
});

test("live feeds are capped, and an app without a docket has no staff routes", async () => {
  const { base } = await serve();
  const feeds = [];
  // Each response is kept, so the connection stays open (a dropped one can be closed when it is garbage collected).
  for (let i = 0; i < 50; i++) { const ac = new AbortController(); const res = await fetch(base + "/api/court/live", { signal: ac.signal }); feeds.push({ ac, res }); assert.equal(res.status, 200); }
  assert.equal((await fetch(base + "/api/court/live")).status, 503);
  feeds.forEach((f) => f.ac.abort());
  const none = await serve({ docket: null });
  assert.equal((await fetch(none.base + "/api/court/live")).status, 404);
});

test("a new day brings a new morning docket, and the paused cases carry on", () => {
  let now = NOW;
  const court = createLiveCourt({ docket: sampleDocket, now: () => now });
  court.boardAction("c11", { type: "arrive", party: "tenant", here: true });
  court.pauseAction("p1", { type: "lift" });
  now += 24 * 3600 * 1000;
  const s = court.snapshot();
  assert.equal(s.day, "2026-11-07");
  assert.equal(s.board.find((c) => c.id === "c11").stage, "waiting");
  assert.equal(s.pauses.find((p) => p.id === "p1").state, "lifted");
});
