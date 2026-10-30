# Let’s Get Ready for Court

Legal information for self-represented tenants in Indiana eviction cases. A student prototype (Team 9, AI for Impact, Northeastern University) for the Indiana Supreme Court Office of Judicial Administration. Legal information only, never legal advice.

## Quick start (for the team and professors)

You can run the whole prototype on your own computer in about five minutes. **You do not need an account, a password or an API key** for the demo.

**What you need**

- **Node.js 22.9 or newer.** Check with `node -v`. If it is missing or older, install the “LTS” version from [nodejs.org](https://nodejs.org) (it includes `npm`).
- **Git**, to download the code (or use GitHub’s green “Code” button → “Download ZIP” and unzip it).
- A recent browser (Chrome, Edge, Firefox or Safari).

**Steps**

```bash
git clone https://github.com/raj0608/legal-document-validator.git
cd legal-document-validator
npm install
npm run demo
```

Then open **http://localhost:3000** in your browser. To stop the server, press `Ctrl+C` in the terminal.

`npm run demo` is the real site with **clearly labelled sample answers** instead of the AI: no key, no cost, nothing leaves your computer. A yellow bar at the top says so. Everything else (reading PDFs, hiding private details, dates, court holidays, form checks, reminders, calendar file, menus, languages) is the real code.

**Try this first (2 minutes)**

1. On Home choose **I got court papers**, then **Try a sample paper**, then **Continue**.
2. Step 2: press **Explain this paper**. Step 3 shows the dates found. Step 4 lets you ask a question.
3. Open **My dates** to see reminders and the calendar file.
4. Back on Home choose **The clerk sent my filing back**, then **Try a sample clerk notice**: it shows the fix-by date.
5. Try the language menu (Spanish is built in), **A+ Bigger text**, and **Hide this page**.
6. Want to see the safety layer? Add `?tester` to the address (`http://localhost:3000/?tester`), use **Try the safety test paper**, and open “See exactly what is sent”.

**Running with the real AI** (needs an Anthropic API key; each answer costs a little)

```bash
cp .env.example .env        # Windows: copy .env.example .env
# open .env in a text editor and paste your key after ANTHROPIC_API_KEY=
npm start                   # http://localhost:3000
```

The `.env` file is ignored by git, so your key is never uploaded. The key stays on the server and is never sent to the browser. Without a key, `npm start` still works, but the AI helper, chat and translation show “not available” (dates, form checks, questions and privacy still work).

**Checking it works:** `npm test` runs the automatic checks (about 100, a few seconds, no key needed).

**If something goes wrong**

| What you see | What to do |
|---|---|
| `node: command not found` or `npm: command not found` | Install Node.js (see above), then open a new terminal. |
| `node: bad option: --env-file-if-exists` | Your Node is too old. Install 22.9 or newer. |
| `address already in use` / `EADDRINUSE` | Something else uses port 3000. Use another: `PORT=3001 npm run demo` (Mac/Linux), `set PORT=3001&& npm run demo` (Windows cmd), or `$env:PORT=3001; npm run demo` (PowerShell). Then open that port. |
| The page looks old after you change code | Reload the page. The browser keeps modules until you do. |
| “The AI helper isn’t available in this view” | You started with `npm start` and no key. Use `npm run demo`, or add a key. |
| Page text is in English after choosing a language | Only English and Spanish are built in; the others are translated by the AI, which is off in demo mode. |

Learning the project? Read [docs/study-guide.md](docs/study-guide.md) first, then [docs/design.md](docs/design.md).

## Settings

| Setting (`.env`) | Default | What it does |
|---|---|---|
| `ANTHROPIC_API_KEY` | none | Stays on the server. Never sent to the browser. |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` | Model for answers and translation. |
| `AI_EFFORT` | `medium` | Thinking depth. |
| `AI_REFUSAL_FALLBACK` | off | `1` retries a safety refusal on another model inside the same call. Not tested against the live API yet. |
| `RATE_LIMIT_PER_MIN` | `20` | Per client address. |
| `DAILY_REQUEST_CAP` | `2000` | All clients together; resets at midnight UTC. In memory only. |
| `TRUST_PROXY` | unset | Number of proxies in front of the server (usually `1`), so rate limits see real addresses. |

## How it is put together

```
public/    the page: index.html, styles.css, js/ (one module per screen, nav.js, home.js, api-client.js)
shared/    code and data used by the browser, the server and the tests
             safety.js    injection filter, redaction, should/must detector
             dates.js     date and reminder math
             analysis.js  dates, citations, form checklist, fix-by date (no AI)
             pdf-text.js  reads a PDF with pdf.js, including typed form-field values
             holidays.js  court holidays and court-day counting
             nav.js       the map of screens and the four-step path
             i18n.js      all page text, FAQ, source links
server/    Express app: routes, input checks, prompts (the rules live here), Anthropic client
tests/     node:test; golden/ holds outputs captured from the original single-file code;
             fixtures/ holds fictional PDFs (rebuild with node tests/fixtures/make-fixtures.mjs)
legacy/    the original single-file prototype, kept for reference
```

### What protects a paper before any AI call

1. **In the browser:** invisible characters removed, text that looks like instructions to an AI removed, private details replaced with tokens such as `[NAME_1]`. Tokens are restored only on screen.
2. **On the server, for every request:** the instruction filter runs again, and a request that still contains an SSN, email, phone, card, account, case, attorney or birth-date pattern is refused (`pii_detected`). Size limits apply.
3. **Prompts:** the rules and sources are on the server and cannot be changed from the browser. The paper is wrapped in a delimiter with a fresh random value for each request.
4. **Nothing stored:** no database, no files, no request bodies in logs (method, path, status, time and token counts only).

## Differences from the single-file prototype

Behavior is meant to be identical except these deliberate fixes, each covered by a test:

- A name is now hidden everywhere once it is known (the original only hid it after a label like `Defendant:`; for example `/s/ Kimi Sample` on a signature line was sent).
- A phone number or name typed in the chat can no longer reuse a token the paper already has.
- A card number no longer swallows the space after it.
- New message `err_pii` (English and Spanish) for the refused-request case.
- “Save my dates” now makes the file in the browser instead of using claude.ai’s downloads.

## Design

How people move through the product (home, the four-step “My papers” path, the four-item menu, phone layout) and the research behind it are in [docs/design.md](docs/design.md), including a script for testing it with real litigants. Two switches for the team: `npm run demo` (sample answers) and `?tester` at the end of the address (shows the safety test paper).

## PDFs

The PDF is read inside the browser and never uploaded. pdf.js and the Atkinson Hyperlegible font are served from this site (`/vendor`, from the pinned npm packages), so a visit makes no request to Google, a CDN or anyone else, and the page’s security policy allows none.

What the reader handles, each covered by a test on a real PDF:

- Plain text PDFs, including a hearing time and room that wrap across lines.
- **Fillable forms.** pdf.js leaves typed field values out of its text. The reader adds them next to their labels (`Signature: /s/ Kimi Sample`), shows empty fields as blanks (`Phone: ____`) and checkboxes as `[x]` / `[ ]`.
- **Flattened forms** (filled in, then saved as a plain PDF): pdf.js returns the typed values at the end of the page, away from their labels. The reader moves each back onto the row of its label.
- Picture-only (scanned) PDFs: no text, so the page says so. No OCR yet.
- Papers longer than 40 pages: the first 40 are read and the page says “First 40 of 45 pages read”.
- Password-protected PDFs and older XFA forms get their own messages.

Two of the court’s own forms are kept as pinned copies in `tests/fixtures/real/` and tested: the Allen County Notice of Eviction Claim (rev. 1-25, a printable form) and the Indiana Legal Help continuance packet (Sept. 2024, 9 pages, 86 fillable fields). Put any other PDFs in that folder and `npm test` will read them, protect them and report page and field counts.

What reading those two forms taught us, now fixed and tested:

- The continuance packet prints its own ☐ boxes next to its radio-button fields; the reader now shows each box once, with its state (`[ ]` or `[x]`).
- The Allen County notice mentions continuances on its back, so it was labelled “a request to move a hearing”. A paper is now typed from the top of the page only.
- On both forms the signature line has no field (it is signed by hand), so `Signature:   Date:` counted as filled in. A line whose only text is the next label now counts as blank.

Not verified yet: PDFs in Chinese, Japanese or Korean (the character maps are served, but there is no test PDF), two-column layouts, and forms filled in by real people (the court forms tested here were blank).

Known side effect: a court’s own street address (for example the Allen Superior Court’s on the notice) is hidden like any other address, so the AI sees `[ADDRESS_1]` for it.

## Calendar file and checklist boxes

**My dates → “Add all to my calendar (.ics file)”** makes one file with every upcoming date and the reminders the person chose as built-in alarms (`shared/ics.js`). It is made in the browser and works with iPhone, Google, Outlook and desktop calendars. Times are “floating” (9:00 means 9:00 on the phone that opens it) and alarms are relative to the start, which every calendar app understands. The Google Calendar links are still there.

**Checklist boxes:** an unchecked `[ ]` counts as a blank unless it is in a group of boxes (on neighbouring lines) where another box is checked, because then the person has already chosen.

## Court holidays

Business-day counts (the clerk’s “three business days”, Trial Rule 88) skip weekends and court holidays, and the page lists which holidays it skipped. Two other dates also use the holiday list:

- **Last day to ask in person to move a hearing** (Allen County: more than 7 days before). Asked in person, it cannot fall on a day the clerk’s office is closed, so it moves back to the last court day, and the page says so.
- **Last day to ask for a jury trial** stays on the 10th day. If that day is a weekend or holiday, the page adds that Trial Rule 6(A) can move a deadline like it to the next court day, and names that day.

Sources (read 2026-10-30): [Trial Rule 6(A)](https://rules.incourts.gov/Content/trial/rule6/current.htm) (legal holidays “as defined by state statute”), [Trial Rule 88](https://rules.incourts.gov/Content/trial/rule88/current.htm) (says “business days”, defines nothing), IC 1-1-9-1 (the holidays and the Saturday/Sunday rule), and the courts’ [state holidays page](https://secure.in.gov/courts/holidays) (dates for 2026 and 2027).

`shared/holidays.js` works out the dates from the statute’s rules, so any year works with no yearly update. For 2026 and 2027 a test checks it against the court’s published list (`tests/fixtures/court-holidays-published.json`).

**Decision for the court:** the statute and the court’s list disagree on two holidays. Lincoln’s Birthday is Feb 12 in the statute but the Friday after Thanksgiving on the court’s list; Washington’s Birthday is the third Monday in February in the statute but Dec 24 (2026) on the court’s list. The code counts neither, because counting a day that is not a holiday would make a deadline later than it really is. It counts the twelve holidays both sources agree on. If the court says which dates are right, flip `counted` in `shared/holidays.js`. The courts’ page also says county clerk’s offices may keep different holidays, so the page still tells people to check with the clerk.

## Security notes

- **pdf.js 3.11.174 has a published advisory** ([GHSA-wgrm-67xf-hhpq](https://github.com/advisories/GHSA-wgrm-67xf-hhpq): a crafted PDF could run code through font handling). The advisory’s workaround is to open PDFs with `isEvalSupported: false`. We always do (`shared/pdf-text.js`, covered by a test, and a caller cannot turn it back on). Upgrading to a current pdf.js is a breaking change and is planned. `npm audit` also reports `tar`, which comes in through an optional build-time tool of pdf.js and is not used when the site runs.
- The AI key lives only in `.env` on the server (ignored by git). Never commit it. If a key is ever pushed by mistake, revoke it in the Anthropic console at once.
- This is a class prototype, not an audited court system. “What a real launch would need” is on the Privacy screen.

## Known gaps

See `test.todo` in `tests/advice.test.js`: the should/must detector has no patterns for Tagalog, Somali, Burmese, Bengali, Gujarati, Punjabi, Nepali or Amharic, and only catches second-person phrasing in English. A deadline given in hours (“within 72 hours”) is still counted in calendar days. Also not done yet: OCR, citation lookup, real text/email reminders, human review of translations.
