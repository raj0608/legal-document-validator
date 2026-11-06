// The citation lookup for the court staff page: the CourtListener adapter against a fake database (no network, no token),
// the route's input checks, its cache, and what the demo lookup knows.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../../server/http/app.js";
import { createCourtListener } from "../../server/citations/courtlistener.js";
import { createDemoLookup } from "../../server/citations/demo-lookup.js";
import { createLookupCache } from "../../server/citations/lookup-cache.js";
import { ApiError } from "../../server/errors.js";
import { open, shutdown } from "./fake-anthropic.js";

after(() => Promise.all([...open].map(shutdown)));

const GOLDBERG = { volume: "397", reporter: "U.S.", page: "254" };
const FAKE = { volume: "912", reporter: "N.E.2d", page: "4471" };
const answer = (status, body) => async () => ({ status, ok: status >= 200 && status < 300, json: async () => body });

// What CourtListener sends back for "397 U.S. 254\n912 N.E.2d 4471": an entry for each citation it read.
const DB_REPLY = [
  { citation: "397 U.S. 254", start_index: 0, end_index: 12, status: 200, clusters: [{ id: 108100, case_name: "Goldberg v. Kelly", date_filed: "1970-03-23", absolute_url: "/opinion/108223/goldberg-v-kelly/" }] },
  { citation: "912 N.E.2d 4471", start_index: 13, end_index: 28, status: 404, error_message: "Citation not found: '912 N.E.2d 4471'", clusters: [] }
];

async function serve(citations) {
  const app = createApp({ citations, config: { log: false } });
  const server = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  open.add(server);
  const base = "http://127.0.0.1:" + server.address().port;
  return { post: (body) => fetch(base + "/api/cites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), close: () => shutdown(server) };
}

test("the adapter sends only citation numbers, with the token, and reads each answer in order", async () => {
  const calls = [];
  const lookup = createCourtListener({ token: "t0ken", fetchFn: async (url, init) => { calls.push({ url: String(url), init }); return answer(200, DB_REPLY)(); } });
  const out = await lookup.lookup([GOLDBERG, FAKE]);
  assert.equal(calls[0].url, "https://www.courtlistener.com/api/rest/v4/citation-lookup/");
  assert.equal(calls[0].init.headers.Authorization, "Token t0ken");
  assert.equal(calls[0].init.body.get("text"), "397 U.S. 254\n912 N.E.2d 4471");
  assert.deepEqual(out[0], { status: "found", clusters: [{ name: "Goldberg v. Kelly", year: 1970, url: "https://www.courtlistener.com/opinion/108223/goldberg-v-kelly/", court: null, courtName: null }] });
  assert.deepEqual(out[1], { status: "not_found", clusters: [] });
});

// A fake CourtListener: the lookup answers with `reply`, and a search says which court decided each cluster.
function fakeDb(reply, { courts = {}, searchStatus = 200 } = {}) {
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push(String(url));
    if (String(url).includes("/search/")) {
      const ids = (new URL(url).searchParams.get("q").match(/\d+/g) || []).map(Number);
      return answer(searchStatus, { results: ids.filter((id) => courts[id]).map((id) => ({ cluster_id: id, court_id: courts[id][0], court: courts[id][1] })) })();
    }
    return answer(200, reply)();
  };
  return { calls, fetchFn };
}

test("each case also gets the court that decided it, from one search that sends only case ids", async () => {
  const db = fakeDb(DB_REPLY, { courts: { 108100: ["scotus", "Supreme Court of the United States"] } });
  const out = await createCourtListener({ token: "x", fetchFn: db.fetchFn }).lookup([GOLDBERG, FAKE]);
  assert.equal(out[0].clusters[0].court, "scotus");
  assert.equal(out[0].clusters[0].courtName, "Supreme Court of the United States");
  assert.equal("id" in out[0].clusters[0], false, "the case id is not passed on");
  const search = db.calls.filter((u) => u.includes("/search/"));
  assert.equal(search.length, 1);
  assert.equal(new URL(search[0]).searchParams.get("q"), "cluster_id:(108100)");
  assert.doesNotMatch(search[0], /U\.S\.|254|Goldberg/, "no citation or name goes in the search");
});

test("a search that runs to a second page is followed, but only on CourtListener itself", async () => {
  const two = [0, 1].map((i) => ({ start_index: i * 14, status: 200, clusters: [{ id: 500 + i, case_name: "A v. B", date_filed: "1990-01-01", absolute_url: "/opinion/" + i + "/a/" }] }));
  const cites = [{ volume: "100", reporter: "N.E.2d", page: "10" }, { volume: "101", reporter: "N.E.2d", page: "10" }];
  const seen = [];
  const mk = (next) => async (url) => {
    seen.push(String(url));
    if (!String(url).includes("/search/")) return answer(200, two)();
    if (String(url).includes("page2")) return answer(200, { results: [{ cluster_id: 501, court_id: "ind", court: "Indiana Supreme Court" }], next: "https://evil.example/steal" })();
    return answer(200, { results: [{ cluster_id: 500, court_id: "indctapp", court: "Indiana Court of Appeals" }], next })();
  };
  const out = await createCourtListener({ token: "x", fetchFn: mk("https://www.courtlistener.com/api/rest/v4/search/?page2=1") }).lookup(cites);
  assert.deepEqual(out.map((o) => o.clusters[0].court), ["indctapp", "ind"]);
  assert.ok(!seen.some((u) => u.includes("evil.example")), "a next page on another site is never fetched");
  const off = await createCourtListener({ token: "x", fetchFn: mk("https://evil.example/steal") }).lookup(cites);
  assert.deepEqual(off.map((o) => o.clusters[0].court), ["indctapp", null]);
  assert.ok(!seen.some((u) => u.includes("evil.example")));
});

test("many cases are searched 20 at a time, and a failed search leaves every answer in place with no court", async () => {
  const many = Array.from({ length: 45 }, (_, i) => ({ start_index: i * 14, status: 200, clusters: [{ id: 1000 + i, case_name: "A v. B", date_filed: "1990-01-01", absolute_url: "/opinion/" + i + "/a/" }] }));
  const cites = many.map((_, i) => ({ volume: String(100 + i), reporter: "N.E.2d", page: "10" }));
  const db = fakeDb(many);
  await createCourtListener({ token: "x", fetchFn: db.fetchFn }).lookup(cites);
  assert.equal(db.calls.filter((u) => u.includes("/search/")).length, 3);
  const down = fakeDb(DB_REPLY, { searchStatus: 500 });
  const out = await createCourtListener({ token: "x", fetchFn: down.fetchFn }).lookup([GOLDBERG, FAKE]);
  assert.deepEqual(out.map((o) => o.status), ["found", "not_found"]);
  assert.equal(out[0].clusters[0].court, null);
});

test("every status the database can give is mapped, and a citation it did not answer for is called unrecognised", async () => {
  const reply = [
    { start_index: 0, status: 300, clusters: [{ case_name: "A v. B", date_filed: "1990-01-01", absolute_url: "/opinion/1/a/" }, { case_name: "C v. D", date_filed: "1991-01-01", absolute_url: "/opinion/2/c/" }] },
    { start_index: 9, status: 400, clusters: [] },
    { start_index: 17, status: 429, clusters: [] }
  ];
  const lookup = createCourtListener({ token: "x", fetchFn: answer(200, reply) });
  const out = await lookup.lookup([{ volume: "1", reporter: "F.3d", page: "1" }, { volume: "2", reporter: "Zz.", page: "2" }, { volume: "3", reporter: "F.3d", page: "3" }, { volume: "4", reporter: "F.3d", page: "4" }]);
  assert.deepEqual(out.map((o) => o.status), ["ambiguous", "unrecognised", "limited", "unrecognised"]);
  assert.equal(out[0].clusters.length, 2);
});

test("a link that does not start with / is dropped, so only courtlistener.com addresses reach the page", async () => {
  const reply = [{ start_index: 0, status: 200, clusters: [{ case_name: "A v. B", date_filed: "1990-01-01", absolute_url: "https://evil.example/x" }] }];
  const out = await createCourtListener({ token: "x", fetchFn: answer(200, reply) }).lookup([GOLDBERG]);
  assert.equal(out[0].clusters[0].url, null);
});

test("a bad token, a rate limit and a broken answer become the page's error codes", async () => {
  const code = async (status, body) => { try { await createCourtListener({ token: "x", fetchFn: answer(status, body) }).lookup([GOLDBERG]); } catch (e) { assert.ok(e instanceof ApiError); return e.code; } };
  assert.equal(await code(401, {}), "unavailable");
  assert.equal(await code(403, {}), "unavailable");
  assert.equal(await code(429, {}), "rate_limited");
  assert.equal(await code(500, {}), "generic");
  assert.equal(await code(200, { not: "a list" }), "generic");
  const down = createCourtListener({ token: "x", fetchFn: async () => { throw new TypeError("fetch failed"); } });
  await assert.rejects(down.lookup([GOLDBERG]), (e) => e.code === "generic");
});

test("the route returns an answer for each citation, and asks the database only once for a repeat", async () => {
  let calls = 0;
  const citations = { async lookup(c) { calls++; return c.map(() => ({ status: "found", clusters: [{ name: "Goldberg v. Kelly", year: 1970, url: null }] })); } };
  const s = await serve(citations);
  const first = await (await s.post({ cites: [GOLDBERG] })).json();
  assert.equal(first.data.results[0].status, "found");
  await s.post({ cites: [GOLDBERG] });
  assert.equal(calls, 1);
  await s.close();
});

test("an answer that was rate limited is not remembered", async () => {
  let calls = 0;
  const citations = { async lookup(c) { calls++; return c.map(() => ({ status: "limited", clusters: [] })); } };
  const s = await serve(citations);
  await s.post({ cites: [GOLDBERG] }); await s.post({ cites: [GOLDBERG] });
  assert.equal(calls, 2);
  await s.close();
});

test("the route refuses anything but citation numbers, and says unavailable when no lookup is set up", async () => {
  const s = await serve(createDemoLookup());
  const code = async (body) => { const r = await s.post(body); return [r.status, (await r.json()).error.code]; };
  assert.deepEqual(await code({}), [400, "bad_request"]);
  assert.deepEqual(await code({ cites: [] }), [400, "bad_request"]);
  assert.deepEqual(await code({ cites: [{ volume: "397", reporter: "U.S.", page: "254", text: "Kimi Sample, 000-12-3456" }, { volume: "1; DROP", reporter: "U.S.", page: "1" }] }), [400, "bad_request"]);
  assert.deepEqual(await code({ cites: [{ volume: "397", reporter: "U.S. <script>", page: "254" }] }), [400, "bad_request"]);
  assert.deepEqual(await code({ cites: Array.from({ length: 101 }, () => GOLDBERG) }), [413, "prompt_too_large"]);
  await s.close();
  const off = await serve(null);
  assert.deepEqual(await (async () => { const r = await off.post({ cites: [GOLDBERG] }); return [r.status, (await r.json()).error.code]; })(), [503, "unavailable"]);
  await off.close();
});

test("extra fields in a citation are not passed on to the lookup", async () => {
  let seen;
  const s = await serve({ async lookup(c) { seen = c; return c.map(() => ({ status: "not_found", clusters: [] })); } });
  await s.post({ cites: [{ ...GOLDBERG, text: "private", name: "Kimi Sample" }] });
  assert.deepEqual(seen, [GOLDBERG]);
  await s.close();
});

test("the demo lookup knows three real cases and calls everything else not found", async () => {
  const out = await createDemoLookup().lookup([{ volume: "405", reporter: "U.S.", page: "56" }, GOLDBERG, { volume: "424", reporter: "U.S.", page: "319" }, FAKE]);
  assert.deepEqual(out.map((o) => o.status), ["found", "found", "found", "not_found"]);
  assert.equal(out[0].clusters[0].name, "Lindsey v. Normet");
});

test("the cache forgets after its time is up", () => {
  let t = 0;
  const cache = createLookupCache({ ttlMs: 1000, now: () => t });
  cache.set("a", 1);
  assert.equal(cache.get("a"), 1);
  t = 1001;
  assert.equal(cache.get("a"), undefined);
});
