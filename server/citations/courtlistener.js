// Looks citations up in CourtListener (Free Law Project), a free public case-law database.
// Only citation numbers go there ("397 U.S. 254"), never the filing. The token stays in this process.
//
// What every citation lookup offers: lookup(cites, signal) takes [{ volume, reporter, page }] and returns one answer for each,
// in the same order: { status, clusters: [{ name, year, url }] } with status found | ambiguous | not_found | unrecognised | limited.
import { ApiError } from "../errors.js";

const ORIGIN = "https://www.courtlistener.com";
const ENDPOINT = ORIGIN + "/api/rest/v4/citation-lookup/";
const STATUS = { 200: "found", 300: "ambiguous", 404: "not_found", 400: "unrecognised", 429: "limited" };
const MAX_CLUSTERS = 5;

// One citation per line. `start` says where each line begins, so an answer can be matched to the citation it is about.
function toText(cites) {
  let at = 0;
  const lines = cites.map((c) => { const line = c.volume + " " + c.reporter + " " + c.page; const start = at; at += line.length + 1; return { line, start, end: start + line.length }; });
  return { text: lines.map((l) => l.line).join("\n"), lines };
}

function toCluster(k) {
  const year = Number(String(k.date_filed || "").slice(0, 4)) || null;
  const url = typeof k.absolute_url === "string" && k.absolute_url.startsWith("/") ? ORIGIN + k.absolute_url : null;
  return { name: String(k.case_name || k.case_name_full || ""), year, url };
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
      return out;
    }
  };
}
