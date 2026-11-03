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

**Checking it works:** `npm test` runs the automatic checks (about 170, a few seconds, no key needed).

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

Learning the project? Read [docs/study-guide.md](docs/study-guide.md) first, then [docs/design.md](docs/design.md). Changing the code, alone or with an AI tool? Read [CONTRIBUTING.md](CONTRIBUTING.md).

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
| `COURTLISTENER_TOKEN` | none | Free CourtListener token for the court staff page’s citation lookup. Stays on the server. Without it that page lists citations but checks none. |
| `RATE_LIMIT_PER_MIN` | `20` | Per client address. |
| `DAILY_REQUEST_CAP` | `2000` | All clients together; resets at midnight UTC. In memory only. |
| `TRUST_PROXY` | unset | Number of proxies in front of the server (usually `1`), so rate limits see real addresses. |

## How it is put together

```
app/       the page, as the browser loads it (no bundler); each page is the folder of its address
             layout.html  the frame of the page: header, menu, footer; each page’s markup is pulled in by an include line
             main.js      starts the page
             page.html    Home (#home)
             papers/      My papers (#papers, four steps)
             check/       Check my form (#check), opened from Home
             dates/       My dates (#dates)
             court/       Filing check for court staff (#court), opened from the footer, not the menu
             help/        Help (#help)
                            privacy/     Privacy (#help/privacy), opened from Help
                            a page’s folder holds page.html (its markup), page.js (the functions main.js calls to
                            set the page up and draw it), components/ (its parts, each one’s markup beside its code,
                            like timeline.html and timeline.js) and, when they need one, lib/
             shared/      what belongs to no single page
                            state.js     the page’s state, in memory only
                            layout/      menu and steps, language picker, page controls, support line, next-date strip
                            ui/          toast, paper loader, AI helper, warnings under AI answers
                            api/         calls to our own server (/api)
                            lib/         finding elements, page text, writing dates, showing answers, reading PDFs
             styles/      the look, in several files loaded in order
shared/    code and data used by the browser, the server and the tests
             safety/      injection filter, redaction, what is sent (protect.js), should/must detector
             analysis/    dates, laws and rules, case citations, case names, citation report, form checklist, fix-by date (no AI)
             dates/       date math, court holidays, case dates, reminders, the calendar file
             i18n/        the languages and all page text, FAQ, source links
             answer-dates.js   dates in AI answers: highlighted, and checked against the paper
             pdf-text.js       reads a PDF with pdf.js, including typed form-field values
             screen-map.js     the map of screens and the four-step path
             sample-papers.js  the fictional sample papers
server/    the server: it keeps the AI key and the rules, and is the only part that talks to the AI
             main.js      npm start: reads .env, picks the AI, starts the server
             demo.js      npm run demo: the same server with sample answers instead of the AI
             config.js    the settings read from .env
             checks.js    the second check on every request, before anything goes to the AI
             prompts.js   the rules the AI follows (they live here)
             translate.js machine translation of the page text
             citations/   the case-law lookup for the court staff page: courtlistener.js (the real one), demo-lookup.js, lookup-cache.js
             errors.js    the error codes the page knows how to show
             ai/          the AI connections
                            port.js      what every AI connection offers: stream and json
                            choose.js    picks one from .env and builds it
                            json.js      reads an answer given as JSON
                            adapters/    gemini.js, anthropic.js; demo-client.js stands in for Anthropic’s client in the demo
             http/        the web server
                            app.js         puts it together: security headers, request log, limits, routes,
                                           streaming, error replies, the page and the static files
                            serve-page.js  puts the page together from app/layout.html and each page’s page.html
tests/     node:test, in the same folders as the code: shared/, server/, app/
             layout.test.js       checks the layout rules below
             agent-rules.test.js  keeps the AI coding tools’ rule files (AGENTS.md) in shape
             golden/      outputs captured from the original single-file code
             fixtures/    fictional PDFs (rebuild with node tests/fixtures/make-fixtures.mjs) and two real court forms
legacy/    the original single-file prototype, kept for reference
AGENTS.md  the rules AI coding tools follow in this repo (app/, server/ and shared/ add their own); see CONTRIBUTING.md
```

### The rules the layout follows

- **One job per file, named for what it holds.** `holidays.js` holds court holidays and `checks.js` holds the server’s checks. There is no `utils.js`. A file that grows past about 200 lines is split by what its parts do.
- **A page is the folder of its address.** `#papers` is `app/papers/`, `#check` is `app/check/`, and Home is `app/page.html`. A page’s folder holds `page.html` (its markup), `page.js` (the functions `main.js` calls to set the page up and draw it) and `components/` (its parts: a part with markup of its own keeps it in a `.html` file beside its `.js`, like `timeline.html` and `timeline.js`; `main.js` also calls some parts directly). Home has only `page.html`: its card is drawn by `app/shared/layout/next-date.js`. A page opened from another page sits inside that page’s folder: Privacy, opened from Help, is `app/help/privacy/`, at `#help/privacy`. A page uses another page only through its `page.js`.
- **Shared parts live in shared folders.** What belongs to no single page (the menu and steps, the paper loader, the toast, the page text) is in `app/shared/`. A page’s own drawing stays in its folder even when another page asks for it: My papers and Check my form call the dates page’s `renderDates`. What the browser, the server and the tests all use is in the top-level `shared/`. It holds only plain code (nothing that needs a browser, Node or a package), so the same file runs in all three places and they cannot disagree.
- **An import names the file that holds the thing.** For example `import { protect } from "/shared/safety/protect.js"`. No `index.js` file passes things on. Files in `app/` import by the address from the site root (`/app/...`, `/shared/...`), even from the same folder, so an import reads the same wherever it is. Files in `shared/` import each other by relative path, because Node runs them too.
- **The AI is plugged in, not built in.** `server/ai/port.js` says what every AI connection offers: an answer streamed piece by piece (`stream`) and an answer read as data (`json`), with every failure turned into one of the error codes the page knows. `gemini.js` and `anthropic.js` in `server/ai/adapters/` each do that for one AI. `demo-client.js` stands in for the Anthropic client, so the demo runs through `anthropic.js` with sample answers. `server/ai/choose.js` picks one from `.env`. The rest of the server only uses the AI it is given, so another AI means one new adapter and a few lines in `choose.js`, and nothing in `server/http/` changes.
- **The page is put together when it is served.** `app/layout.html` is the frame. A line like `<!-- include: /app/papers/page.html -->` is replaced by that file (`server/http/serve-page.js`). A page pulls in its components’ markup the same way. There is no bundler: edit a `.html` file and reload. If an included file is missing, the page does not load, and the server’s console names the file. The line `<!-- modulepreload: /app/main.js -->` becomes one preload link for every module `main.js` needs, so the browser asks for them all at once instead of one import level at a time.
- **Only the start files start things.** `app/main.js`, `server/main.js` and `server/demo.js` are the only files that do something as soon as they load. Every other file only defines functions and data.
- **Tests follow the same layout.** `tests/shared/`, `tests/server/` and `tests/app/` test the folders of the same name. `tests/layout.test.js` checks the rules above: every import points at a real file and a real name, `app/` imports by the address from the site root, `shared/` imports only `shared/` and uses nothing that only a browser or Node has, a page uses another page only through its `page.js`, only `server/ai/` and the start files know which AI is used, and no file passes 200 lines or has a catch-all name like `utils`.

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

## Filing check for court staff

Open **For court staff** in the footer (`#court`). Add a filing (PDF, pasted text, or the sample filing) and press **Check the citations**. The page lists every case citation it can read (such as `397 U.S. 254`), looks each one up in [CourtListener](https://www.courtlistener.com), a free public case-law database, and shows one line for each: **Found**, **Name differs**, **Year differs**, **More than one match**, **Not found**, **Not recognised** or **Not checked**, the clearest signs first, with a link to the case. Laws and rules (`IC 32-31-8-5`, `Trial Rule 12(B)`) are listed with links but not checked. The report prints.

- **It does not detect AI writing, and says so on the page.** Detectors are unreliable and flag people who write in a second language, and using AI is not the problem; made-up cases are.
- **It decides nothing.** Under Trial Rule 88 a clerk can reject an e-filing only for an unpaid fee, a wrong case-management system, or the filer’s own request. Anything else is for a judge. “Not found” can also mean the database has a gap, and the page says so.
- **The filing never leaves the browser.** Only `volume reporter page` for each citation goes to our server (`/api/cites`, which accepts nothing else and checks it in `server/checks.js`), and from there to CourtListener. Answers are remembered for an hour in memory only.
- **Not checked yet:** whether a case says what the filing says it does, whether quotations are real, whether laws and rules exist, scanned filings (no OCR), and cites to `id.` or `supra`.
- **Setup:** make a free CourtListener account, copy the API token from your profile, and put it in `.env` as `COURTLISTENER_TOKEN=`. `npm run demo` needs no token: it knows three real Supreme Court cases and calls everything else “not found”, so the sample filing shows each kind of line.
- **Run against the live CourtListener API on 2026-11-03** with the sample filing: the three real Supreme Court cases were found with matching names, the wrong-name citation showed the real case, and the invented Indiana citation was not found. Indiana state-court coverage has not been measured yet. CourtListener’s own limits for a signed-in account are low (its docs say 5 requests a minute, 50 an hour, 125 a day), so ask Free Law Project about more before a real pilot.

## Design

How people move through the product (home, the four-step “My papers” path, the four-item menu, phone layout) and the research behind it are in [docs/design.md](docs/design.md), including a script for testing it with real litigants. The look follows the Indiana courts site (in.gov/courts), so the page could sit inside it: the same palette, typefaces, header and menu bar, title and body cards, and footer. It does not use the state seal or call itself an official site; the strip at the top says it is a student prototype. Two switches for the team: `npm run demo` (sample answers) and `?tester` at the end of the address (shows the safety test paper).

## PDFs

The PDF is read inside the browser and never uploaded. pdf.js and the fonts (Readex Pro and Rethink Sans) are served from this site (`/vendor`, from the pinned npm packages), so a visit makes no request to Google, a CDN or anyone else, and the page’s security policy allows none.

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

**My dates → “Add all to my calendar (.ics file)”** makes one file with every upcoming date and the reminders the person chose as built-in alarms (`shared/dates/ics.js`). It is made in the browser and works with iPhone, Google, Outlook and desktop calendars. Times are “floating” (9:00 means 9:00 on the phone that opens it) and alarms are relative to the start, which every calendar app understands. The Google Calendar links are still there.

**Checklist boxes:** an unchecked `[ ]` counts as a blank unless it is in a group of boxes (on neighbouring lines) where another box is checked, because then the person has already chosen.

## Court holidays

Business-day counts (the clerk’s “three business days”, Trial Rule 88) skip weekends and court holidays, and the page lists which holidays it skipped. Two other dates also use the holiday list:

- **Last day to ask in person to move a hearing** (Allen County: more than 7 days before). Asked in person, it cannot fall on a day the clerk’s office is closed, so it moves back to the last court day, and the page says so.
- **Last day to ask for a jury trial** stays on the 10th day. If that day is a weekend or holiday, the page adds that Trial Rule 6(A) can move a deadline like it to the next court day, and names that day.

Sources (read 2026-10-30): [Trial Rule 6(A)](https://rules.incourts.gov/Content/trial/rule6/current.htm) (legal holidays “as defined by state statute”), [Trial Rule 88](https://rules.incourts.gov/Content/trial/rule88/current.htm) (says “business days”, defines nothing), IC 1-1-9-1 (the holidays and the Saturday/Sunday rule), and the courts’ [state holidays page](https://secure.in.gov/courts/holidays) (dates for 2026 and 2027).

`shared/dates/holidays.js` works out the dates from the statute’s rules, so any year works with no yearly update. For 2026 and 2027 a test checks it against the court’s published list (`tests/fixtures/court-holidays-published.json`).

**Decision for the court:** the statute and the court’s list disagree on two holidays. Lincoln’s Birthday is Feb 12 in the statute but the Friday after Thanksgiving on the court’s list; Washington’s Birthday is the third Monday in February in the statute but Dec 24 (2026) on the court’s list. The code counts neither, because counting a day that is not a holiday would make a deadline later than it really is. It counts the twelve holidays both sources agree on. If the court says which dates are right, flip `counted` in `shared/dates/holidays.js`. The courts’ page also says county clerk’s offices may keep different holidays, so the page still tells people to check with the clerk.

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

See `test.todo` in `tests/shared/advice.test.js`: the should/must detector has no patterns for Tagalog, Somali, Burmese, Bengali, Gujarati, Punjabi, Nepali or Amharic, and only catches second-person phrasing in English. A deadline given in hours (“within 72 hours”) is still counted in calendar days. Also not done yet: OCR, citation lookup, real text/email reminders, human review of translations.
