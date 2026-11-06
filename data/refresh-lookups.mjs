// Looks up every citation in the data sets in CourtListener and saves the answers, so the scoring can run again offline.
//   node --env-file=.env data/refresh-lookups.mjs
// Needs COURTLISTENER_TOKEN in .env. CourtListener allows about 60 citations a minute, so it goes in small batches.
import fs from "node:fs";
import { createCourtListener } from "../server/citations/courtlistener.js";
import { findCaseCitations } from "../shared/analysis/case-citations.js";

const read = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), "utf8"));
const token = process.env.COURTLISTENER_TOKEN;
if (!token) { console.log("Put COURTLISTENER_TOKEN in .env first."); process.exit(1); }

// every distinct citation, in the form the checker reads it
const texts = [
  ...read("citations/real-indiana-citations.json").map((r) => r.cite),
  ...read("citations/fake-indiana-citations.json").items.map((r) => r.cite),
  ...read("synthetic/answer-key.json").items.map((r) => r.cite)
];
const cites = [...new Map(texts.flatMap((t) => findCaseCitations(t)).map((c) => [c.cite, { volume: c.volume, reporter: c.reporter, page: c.page }])).entries()];
const lookup = createCourtListener({ token });
const BATCH = 40, results = {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let todo = cites;
for (let round = 1; todo.length && round <= 4; round++) {
  const next = [];
  for (let i = 0; i < todo.length; i += BATCH) {
    const slice = todo.slice(i, i + BATCH);
    const answers = await lookup.lookup(slice.map(([, c]) => c));
    slice.forEach(([cite], n) => (answers[n].status === "limited" ? next.push(slice[n]) : (results[cite] = answers[n])));
    console.log(`round ${round}: ${Object.keys(results).length}/${cites.length} answered`);
    if (i + BATCH < todo.length || next.length) await sleep(65000);
  }
  todo = next;
}
const out = new URL("snapshots/courtlistener-" + new Date().toISOString().slice(0, 10) + ".json", import.meta.url);
fs.writeFileSync(out, JSON.stringify({ about: "CourtListener citation-lookup answers for every citation in the data sets", fetched: new Date().toISOString(), unanswered: todo.map(([c]) => c), results }, null, 1));
console.log("saved", out.pathname.split("/").pop(), "with", Object.keys(results).length, "answers;", todo.length, "unanswered");
