// Builds the made-up filings and their answer key. No network, and the same result every time (seeded).
//   node data/synthetic/build.mjs
// Each filing is fictional and cites a mix of real Indiana cases (from ../citations/real-indiana-citations.json) with planted errors:
//   ok         a real case, cited correctly                            expect: found
//   fake_case  an invented case at a citation that cannot exist        expect: flagged (not found)
//   wrong_name a real citation under the name of a different case      expect: flagged (name differs)
//   wrong_year a real case cited with the wrong year (3 to 9 off)      expect: flagged (year differs)
//   wrong_court a real case cited as decided by a different court       expect: flagged (court differs)
import fs from "node:fs";

const here = new URL(".", import.meta.url);
const real = JSON.parse(fs.readFileSync(new URL("../citations/real-indiana-citations.json", import.meta.url), "utf8"));

function rng(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rnd = rng(20261106);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const SURNAMES = ["Alder", "Brandt", "Carver", "Dunlap", "Ellison", "Fairchild", "Garrity", "Hollis", "Ingram", "Jessup", "Kessler", "Lindqvist", "Marlowe", "Nolan", "Okafor", "Prescott", "Quimby", "Rutledge", "Sandoval", "Thatcher", "Underhill", "Vance", "Whitaker", "Yoder", "Zeller"];
const PARTIES = ["Lakeview Holdings", "Prairie Property Management", "Riverbend Apartments LLC", "Midwest Rental Group", "Hoosier Housing Partners", "Cedar Court Properties", "Wabash Valley Realty", "Northside Landlords Association", "Summit Lease Services", "Old Mill Residential"];
const LEAD = ["See", "See also", "Accord", "Cf.", "See"];

// A citation that cannot exist: the page is past the end of any volume of that reporter.
function inventedCite() {
  const kind = rnd();
  if (kind < 0.6) { const three = rnd() < 0.4; const year = three ? int(2012, 2024) : int(1960, 2011); return { cite: `${three ? int(1, 200) : int(100, 960)} N.E.${three ? "3d" : "2d"} ${int(2600, 9900)}`, year, court: rnd() < 0.5 ? "Ind." : "Ind. Ct. App." }; }
  if (kind < 0.85) return { cite: `${int(100, 950)} F.3d ${int(3000, 9900)}`, year: int(1995, 2023), court: "7th Cir." };
  return { cite: `${int(300, 990)} F. Supp. 2d ${int(2600, 9900)}`, year: int(1996, 2013), court: "S.D. Ind." };
}

const PER_FILING = 6, FILINGS = 36;
const planted = shuffle([].concat(Array(72).fill("ok"), Array(36).fill("fake_case"), Array(36).fill("wrong_name"), Array(36).fill("wrong_year"), Array(36).fill("wrong_court")));
const key = [];
fs.mkdirSync(new URL("filings/", here), { recursive: true });

for (let f = 1; f <= FILINGS; f++) {
  const id = "filing-" + String(f).padStart(2, "0");
  const lines = ["SAMPLE FILING FOR TESTING. ALL NAMES AND NUMBERS ARE FICTIONAL. THE CASES BELOW ARE CITED TO TEST A CHECKER, NOT AS LEGAL AUTHORITY.", "", "STATE OF INDIANA, COUNTY OF ALLEN", "IN THE ALLEN SUPERIOR COURT, SMALL CLAIMS DIVISION", `Cause No. 02D00-2611-SC-${String(f).padStart(6, "0")}`, "", `${pick(PARTIES)}, Plaintiff,`, "v.", `${pick(SURNAMES)} Sample, Defendant.`, "", "DEFENDANT'S MOTION", "", "The Defendant relies on the authorities below.", ""];
  const used = new Set(); // one citation once in a filing, so each line of the answer key is one thing for the checker to find
  for (let n = 1; n <= PER_FILING; n++) {
    const kind = planted[(f - 1) * PER_FILING + (n - 1)];
    let name, cite, year, court, expect, note = "";
    if (kind === "fake_case") {
      ({ cite, year, court } = inventedCite());
      name = `${pick(SURNAMES)} v. ${pick(PARTIES)}`;
      expect = "flag";
    } else {
      let r;
      do { r = pick(real); } while (used.has(r.cite));
      cite = r.cite; name = r.name; year = r.year; court = r.court; expect = "found";
      if (kind === "wrong_name") { let o; do { o = pick(real); } while (o.cite === r.cite || used.has(o.cite)); name = o.name; expect = "flag"; note = `real name is ${r.name}`; }
      if (kind === "wrong_court") { court = r.court === "Ind." ? (rnd() < 0.6 ? "Ind. Ct. App." : "7th Cir.") : (rnd() < 0.6 ? "Ind." : "7th Cir."); expect = "flag"; note = `real court is ${r.court}`; }
      if (kind === "wrong_year") { year = r.year + (rnd() < 0.5 ? -1 : 1) * int(3, 9); expect = "flag"; note = `real year is ${r.year}`; }
    }
    used.add(cite);
    lines.push(`${n}. ${pick(LEAD)} ${name}, ${cite} (${court} ${year}).`);
    key.push({ filing: id, n, cite, name, year, planted: kind, expect, note });
  }
  lines.push("", "Respectfully submitted,", "Defendant, self-represented");
  fs.writeFileSync(new URL(`filings/${id}.txt`, here), lines.join("\n") + "\n");
}
fs.writeFileSync(new URL("answer-key.json", here), JSON.stringify({ about: "Made-up filings with planted citation errors. Rebuild with: node data/synthetic/build.mjs", count: key.length, items: key }, null, 1));
const by = key.reduce((m, k) => ((m[k.planted] = (m[k.planted] || 0) + 1), m), {});
console.log(FILINGS, "filings,", key.length, "citations:", JSON.stringify(by));
