// Looks citations up in CourtListener (Free Law Project), a free public case-law database.
// Only citation numbers go there ("397 U.S. 254"), never the filing. The token stays in this process.
//
// What every citation lookup offers: lookup(cites, signal) takes [{ volume, reporter, page }] and returns one answer for each,
// in the same order: { status, clusters: [{ name, year, url, court, courtName }] } with status found | ambiguous | not_found | unrecognised | limited.
// `court` is CourtListener's id for the court that decided the case ("ind", "indctapp", "ca7", "mass"), or null when it could not be fetched.
import { ApiError } from "../errors.js";

const ORIGIN = "https://www.courtlistener.com";
const ENDPOINT = ORIGIN + "/api/rest/v4/citation-lookup/";
const STATUS = { 200: "found", 300: "ambiguous", 404: "not_found", 400: "unrecognised", 429: "limited" };
const SEARCH = ORIGIN + "/api/rest/v4/search/";
const MAX_CLUSTERS = 5;
const COURTS_AT_A_TIME = 20; // one search asks about this many cases
const MAX_SEARCH_PAGES = 4;

// One citation per line. `start` says where each line begins, so an answer can be matched to the citation it is about.
function toText(cites) {
  let at = 0;
  const lines = cites.map((c) => { const line = c.volume + " " + c.reporter + " " + c.page; const start = at; at += line.length + 1; return { line, start, end: start + line.length }; });
  return { text: lines.map((l) => l.line).join("\n"), lines };
}

function toCluster(k) {
  const year = Number(String(k.date_filed || "").slice(0, 4)) || null;
  const url = typeof k.absolute_url === "string" && k.absolute_url.startsWith("/") ? ORIGIN + k.absolute_url : null;
  return { id: k.id, name: String(k.case_name || k.case_name_full || ""), year, url, court: null, courtName: null };
}

export function createCourtListener({ token, fetchFn = fetch, timeoutMs = 15000 }) {
  return {
    provider: "courtlistener",
    async lookup(cites, signal) {
      const { text, lines } = toText(cites);
      let res;
      try {
        res = await fetchFn(ENDPOINT, {
          method: "POST",
          headers: { Authorization: "Token " + token, Accept: "application/json" },
          body: new URLSearchParams({ text }),
          signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs)
        });
      } catch (e) { throw new ApiError("generic", 502); }
      if (res.status === 401 || res.status === 403) throw new ApiError("unavailable", 503);
      if (res.status === 429) throw new ApiError("rate_limited", 429);
      if (!res.ok) throw new ApiError("generic", 502);
      let items;
      try { items = await res.json(); } catch (e) { throw new ApiError("generic", 502); }
      if (!Array.isArray(items)) throw new ApiError("generic", 502);
      // A citation the database could not even read as a citation gets no answer: say so, rather than guess.
      const out = cites.map(() => ({ status: "unrecognised", clusters: [] }));
      const done = new Set();
      for (const it of items) {
        const i = lines.findIndex((l) => it.start_index >= l.start && it.start_index < l.end + 1);
        if (i < 0 || done.has(i)) continue;
        done.add(i);
        out[i] = { status: STATUS[it.status] || "unrecognised", clusters: (Array.isArray(it.clusters) ? it.clusters : []).slice(0, MAX_CLUSTERS).map(toCluster) };
      }
      await addCourts(out, { token, fetchFn, timeoutMs, signal });
      for (const o of out) for (const c of o.clusters) delete c.id; // the id was only for finding the court
      return out;
    }
  };
}

// The lookup does not say which court decided a case, and a filing that cites an Indiana case may be pointing at an Illinois one.
// A search asks for up to 20 cases at once. It answers with a row for each opinion (a case with a dissent has two), so it can run to
// a second page; the next pages are followed, but only on CourtListener itself. If a search fails the answers still stand, with no
// court, so a problem here never hides a result.
async function addCourts(out, { token, fetchFn, timeoutMs, signal }) {
  const clusters = out.flatMap((o) => o.clusters).filter((c) => Number.isInteger(c.id));
  const byId = new Map(clusters.map((c) => [c.id, c]));
  const get = (url) => fetchFn(url, { headers: { Authorization: "Token " + token, Accept: "application/json" }, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs) });
  for (let i = 0; i < clusters.length; i += COURTS_AT_A_TIME) {
    const batch = clusters.slice(i, i + COURTS_AT_A_TIME);
    let url = new URL(SEARCH);
    url.searchParams.set("type", "o");
    url.searchParams.set("highlight", "off");
    url.searchParams.set("q", "cluster_id:(" + batch.map((c) => c.id).join(" OR ") + ")");
    try {
      for (let page = 0; url && page < MAX_SEARCH_PAGES; page++) {
        const res = await get(url);
        if (!res.ok) break;
        const body = await res.json();
        for (const r of Array.isArray(body.results) ? body.results : []) {
          const c = byId.get(r.cluster_id);
          if (c && typeof r.court_id === "string") { c.court = r.court_id; c.courtName = typeof r.court === "string" ? r.court : null; }
        }
        if (batch.every((c) => c.court)) break;
        url = typeof body.next === "string" && body.next.startsWith(ORIGIN + "/") ? body.next : null;
      }
    } catch (e) { /* no court for these; the rest of the answer is unchanged */ }
  }
}
