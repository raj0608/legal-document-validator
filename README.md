# Let’s Get Ready for Court

Legal information for self-represented tenants in Indiana eviction cases. A student prototype (Team 9, AI for Impact, Northeastern University) for the Indiana Supreme Court Office of Judicial Administration. Legal information only, never legal advice.

## Quick start (for the team and professors)

You can run the whole prototype on your own computer in about five minutes. **You do not need an account, a password or an API key** for the demo.

**What you need**

- **Node.js 22.13 or newer.** Check with `node -v`. If it is missing or older, install the “LTS” version from [nodejs.org](https://nodejs.org) (it includes `npm`).
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

**Running with the real AI (Google Gemini, free tier)**

1. Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (a Google account is enough).
2. Make your settings file and paste the key after `GEMINI_API_KEY=`:
   ```bash
   cp .env.example .env        # Windows: copy .env.example .env
   ```
3. Start it:
   ```bash
   npm start                   # http://localhost:3000
   ```
   The first lines it prints say which AI it is using, for example `AI helper: on (gemini: gemini-3.5-flash-lite)`, or why it is off.

The `.env` file is ignored by git, so your key is never uploaded, and the key stays on the server: it is never sent to the browser. Without a key, `npm start` still works, but the AI helper, chat and translation show “not available” (dates, form checks, questions and privacy still work).

**Two things to know about the free tier.** (1) Google’s pricing page says the free plan’s content is “used to improve our products”, so what the site sends to Gemini may be kept and used by Google. The site hides names, phone numbers and other private details first, but the rest of a real case would still go to Google: **use the sample papers, not real ones.** A paid key (Google’s paid plan, or Anthropic) is the way to change that. (2) The free tier has its own limits per project (shown in AI Studio), lower than our own `RATE_LIMIT_PER_MIN`. If many people try it at once, some will see “Too many questions at once”.

Want Claude instead? Put `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY=...` in `.env` (paid).

**Checking it works:** `npm test` runs the automatic checks (about 100, a few seconds, no key needed).

**If something goes wrong**

| What you see | What to do |
|---|---|
| `node: command not found` or `npm: command not found` | Install Node.js (see above), then open a new terminal. |
| `node: bad option: --env-file-if-exists` | Your Node is too old. Install 22.13 or newer. |
| `address already in use` / `EADDRINUSE` | Something else uses port 3000. Use another: `PORT=3001 npm run demo` (Mac/Linux), `set PORT=3001&& npm run demo` (Windows cmd), or `$env:PORT=3001; npm run demo` (PowerShell). Then open that port. |
| The page looks old after you change code | Reload the page. The browser keeps modules until you do. |
| “The AI helper isn’t available in this view” | You started with `npm start` and no working key. Read the line it printed when it started: it says why (no key, or `AI_PROVIDER` set to one without a key). Use `npm run demo`, or fix `.env`. |
| “Too many questions at once” | Gemini’s free tier allows only a few requests a minute per project. Wait a minute and try again. |
| Page text is in English after choosing a language | Only English and Spanish are built in; the others are translated by the AI, which is off in demo mode. |

Learning the project? Read [docs/study-guide.md](docs/study-guide.md) first, then [docs/design.md](docs/design.md).

## Settings

All in `.env` (see `.env.example`). Only one AI key is needed.

| Setting | Default | What it does |
|---|---|---|
| `AI_PROVIDER` | the one whose key is set (Gemini first) | `gemini` or `anthropic`. |
| `GEMINI_API_KEY` | none | Google AI Studio key. Stays on the server. |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Google’s current stable “basic” model; the free tier covers it. `gemini-3.1-flash-lite` is the other free Flash-Lite. |
| `GEMINI_THINKING_LEVEL` | model’s default | `minimal`, `low`, `medium` or `high`. Thinking tokens count toward the output limit. |
| `ANTHROPIC_API_KEY` | none | Only if `AI_PROVIDER=anthropic`. |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` | Model for answers and translation. |
| `AI_EFFORT` | `medium` | Claude’s thinking depth. |
| `AI_REFUSAL_FALLBACK` | off | `1` retries a Claude safety refusal on another model inside the same call. Not tested against the live API yet. |
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
server/    Express app: routes, input checks, prompts (the rules live here), and the AI connections
             (gemini.js, anthropic.js; provider.js picks one from .env)
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

## Live testing with Gemini (2026-10-31)

Every AI route was run against the real Gemini free tier (`gemini-3.5-flash-lite`) with the sample papers, the fillable and flattened PDFs, the two real court forms and a 29,000-character paper, in the API and in the browser. What it found, and what we did:

| Found | Cause | Fix |
|---|---|---|
| The “should/must” warning appeared on the reply that **refused** to advise (“I can’t advise you on what you should do”). | The detector is word-based, and the refusal our rules require contains the words. | `looksLikeAdvice` sets aside only those exact refusal phrasings (English and Spanish). Real advice in the same reply is still flagged (tested). |
| Dates were rarely highlighted, sometimes had no weekday, and the clerk-notice answers showed a literal `==`. | A small model follows the formatting rule only some of the time; the JSON answers were not rendered with highlighting. | `markDates` highlights every date and adds the correct weekday from the calendar; all AI text goes through one safe renderer. |
| The explanation had headings like “Up to 5 hard words with short meanings”, in lower case. | The task prompt listed the parts as instructions and the model copied them. | The prompt now names the headings. The rules text is unchanged. |
| Chat began with “I cannot advise you” even for plain questions. | The model over-applied the advice rule. | The chat prompt says to answer first and refuse only when asked what to do. |
| The AI **invented a deadline range** for a clerk notice (“Wednesday, November 11 through Friday, November 13”): not in the notice, and Nov 11 is a court holiday. | It counted days itself, which the rules forbid but a small model sometimes does. | The prompts say never to work out a date, and the page now **flags any date in an answer that is not in the paper** (`unsupportedDates`). The fix-by date shown above the answer is still computed by code, not by the AI. |
| A form with nothing blank showed an empty card. | No message for “nothing found”. | “No empty lines or boxes were found.” |

Checked and fine: streaming, a 29k paper (about 1.5 s), Arabic, Burmese, Amharic and French translation (14 to 26 s, right-to-left works), a bad key (turns the helper off), the injection paper, a phone number typed into chat. Not fixed: while the page is being translated the waiting message is in English, and the explanation sometimes ignores the 250-word limit. The AI’s answers vary from run to run, so the checks above are tests of the page around the AI; the AI itself should still be spot-checked.

## Security notes

- **pdf.js is current (6.4.299).** The older 3.11.174 we started with had a published advisory ([GHSA-wgrm-67xf-hhpq](https://github.com/advisories/GHSA-wgrm-67xf-hhpq): a crafted PDF could run code through font handling), which is fixed in current versions. We upgraded, and `npm audit` now reports 0 vulnerabilities. As a second layer we still always open PDFs with `isEvalSupported: false` (`shared/pdf-text.js`, covered by a test, and a caller cannot turn it back on). The page loads pdf.js only when someone chooses a PDF, as a module from this site; the upgrade needs Node 22.13 or newer.
- The AI key lives only in `.env` on the server (ignored by git). Never commit it. If a key is ever pushed by mistake, revoke it at once (Google AI Studio for Gemini, the Anthropic console for Claude).
- This is a class prototype, not an audited court system. “What a real launch would need” is on the Privacy screen.

## Known gaps

See `test.todo` in `tests/advice.test.js`: the should/must detector has no patterns for Tagalog, Somali, Burmese, Bengali, Gujarati, Punjabi, Nepali or Amharic, and only catches second-person phrasing in English. A deadline given in hours (“within 72 hours”) is still counted in calendar days. Also not done yet: OCR, citation lookup, real text/email reminders, human review of translations.
