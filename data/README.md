# Data for testing the citation check

Three small data sets, plus the saved answers from CourtListener, so the citation check can be scored without a network or a token. Nothing here is a real person's filing. Real filings from the court stay out of this repo (see the data plan).

| Folder | What | How many | Source |
|---|---|---|---|
| `citations/fake-indiana-citations.json` | Citations that Indiana courts, and federal courts in Indiana, found to be fake or wrong (and 5 more it lists as not readable) | 42 | Damien Charlotin's AI Hallucination Cases database: 20 from its CSV, 22 from the text of the court decisions behind it |
| `citations/real-indiana-citations.json` | Real Indiana citations, spread over the 1950s to 2017, Supreme Court and Court of Appeals | 48 | CourtListener search |
| `synthetic/` | Made-up filings with planted citation errors, and an answer key | 36 filings, 216 citations | We create them (`node data/synthetic/build.mjs`, same result every time) |
| `snapshots/` | What CourtListener answered for every citation above (125 distinct), with the court that decided each case | 1 file | CourtListener citation lookup, 2026-11-06 |

## Credit

The fake citations come from the [AI Hallucination Cases Database](https://www.damiencharlotin.com/hallucinations/) by Damien Charlotin, licensed CC BY 4.0. The CSV was downloaded on 2026-11-06 (2,267 cases). We kept the Indiana rows (39 cases, May 2025 to October 2026: 30 involved a self-represented litigant, 9 a lawyer). The 25 decisions behind the rows with no citation in the CSV were downloaded the same day (25 PDFs, 6.5 MB) and read for the citations the court called fake; each citation in the file was checked to appear in its decision. The file names no litigant: it keeps the database's case id, court, date and a link. Real-citation data comes from CourtListener, a project of Free Law Project.

## Score the check

```bash
node data/score.mjs
```

This runs the real citation code on all three sets and prints how it did. `npm test` runs the same scoring as a graded check (`tests/evals/citation-checker-data.test.js`), so a drop fails the run.

Scores on 2026-11-06:

| Set | Result |
|---|---|
| Real Indiana citations called "found" | 48 of 48 |
| Court-found fake citations flagged | 42 of 42 |
| Made-up filings: correct citations left alone | 72 of 72 |
| Made-up filings: invented cases flagged | 36 of 36 |
| Made-up filings: wrong names flagged | 36 of 36 |
| Made-up filings: wrong years flagged | 36 of 36 |
| Made-up filings: wrong courts flagged | 36 of 36 |

## Read these scores carefully

- **They were tuned on this data, so they are optimistic.** The first scores were lower (real citations 92%, court-found fakes 85%, wrong names 56%). Reading the misses led to fixes in how the check reads and compares names: a comma before "LLC" or "Inc.", "&", a slash or a list of parties inside a name, "In re" names with no "v.", and words like "State" and "County" making unrelated names look alike. A second set of filings made with a different seed found two more misses (a long caption sharing only the word "Indianapolis"), which were fixed too, so that set is now tuning data as well. The honest test is the court's real filings.
- **The real citations come from CourtListener, and the lookup uses CourtListener.** So "found" is nearly guaranteed. This set tests that we read and match real citations correctly, not how many of the citations staff meet are in CourtListener.
- **No Indiana citation after 2017 in `N.E.3d` form came back from CourtListener's search**, so recent cases are missing from the real set. Filings cite recent cases, so this needs checking with real filings.
- **The court check compares only courts it can read with confidence:** Indiana's three state courts, the federal circuits, and the Indiana federal districts. CourtListener gave a court for 75 of 77 cases here. Everything else is "cannot tell", never "different". It treats the Indiana Supreme Court and the Court of Appeals as different courts, so a filing that mixes them up will be flagged.
- **A citation with no case name, no court and no year that lands on a real case cannot be caught.** It looks the same as a correct one.
- **Five fake citations in the decisions cannot be read by the check** (Westlaw numbers, a slip opinion number, a neutral citation, and one with no reporter). They are listed under `notReadable` in the file. Only 22 of the 52 missing items gave a citation in reporter form.
- **The check only catches some of what courts flag.** Of the 133 flagged items in the Indiana cases, 54% are invented cases (what this tool is for). 26% are real cases described wrongly, 5% false quotations, 9% invented or wrongly described laws and rules, 6% other. A person has to read the cases for those.
- **"Not found" does not prove a case is fake.** CourtListener has gaps, mainly trial-court decisions.
- **Each filing check now makes more requests to CourtListener:** the lookup, plus one search for every 20 cases found, to get their courts. CourtListener limits a signed-in account (its docs say 5 requests a minute, 50 an hour, 125 a day), so a busy day could run into that.

## Refresh or rebuild

```bash
node data/synthetic/build.mjs                       # rebuilds the filings and answer key
node --env-file=.env data/refresh-lookups.mjs       # asks CourtListener again (needs COURTLISTENER_TOKEN; about 3 minutes)
```

CourtListener limits a signed-in account (its docs say 5 requests a minute, 50 an hour, 125 a day), and about 60 citations a minute for this lookup, so the refresh goes in small batches.
