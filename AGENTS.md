# Let's Get Ready for Court: rules for AI coding agents

Legal information, never legal advice, for people facing an eviction case in Indiana. A Node/Express server, a browser app with no build step, and plain code that both share.
These AGENTS.md files are the only agent rules in this repo. Edit only them: each CLAUDE.md is a one-line stub that loads the AGENTS.md beside it. Do not add rule files for one tool (`.cursorrules`, `.rules`, `GEMINI.md`, `.github/copilot-instructions.md` and the like).

## Commands

Run them from the repo root. They work in bash, PowerShell and cmd.

- Install: `npm install` (Node 22.13 or newer).
- Run with sample answers, no key needed: `npm run demo`, then open http://localhost:3000.
- Run with the real AI: `npm run dev` (reads `.env`, restarts when server code changes).
- All tests: `npm test`. One file: `node --test tests/shared/dates.test.js`. One folder: `node --test "tests/server/*.test.js"`, not `node --test tests/server/`.
- Never run `tests/fixtures/make-fixtures.mjs`. It rewrites the fixture PDFs the tests compare against.

## Before you edit an area

- Before editing anything under `web/`, read `web/AGENTS.md`.
- Before editing anything under `server/`, read `server/AGENTS.md`.
- Before editing anything under `shared/`, read `shared/AGENTS.md`.

README.md, "How it is put together", is the map of the folders. Read it instead of guessing where a file goes.

## Layout rules

`tests/layout.test.js` fails when one of these breaks, and its message names the file.

- One concern per file, named for what it holds. Never `utils`, `helpers`, `misc`, `common` or `index.js`. A file that passes 200 lines gets split by what its parts do.
- An import names the file that defines the thing. No `export { } from`, no `export *`, no barrel files.
- `shared/` is plain code that runs unchanged in the browser, in Node and in the tests: no DOM, no `node:` modules, no npm packages, and relative imports that stay inside `shared/`.
- `web/` imports by address from the site root (`/web/...`, `/shared/...`), even inside one folder. Never a bare package name: there is no bundler.
- `web/` and `server/` never import each other. Only `server/main.js`, `server/demo.js` and `server/ai/` know which AI is in use.
- A screen is a folder in `web/screens/`. Another screen may call its `screen.js`, never its `components/` or `lib/`. Code two screens need moves to `web/shared/`; code the server needs too moves to the top-level `shared/`.
- Only `web/main.js`, `server/main.js` and `server/demo.js` run code when they load. Every other file only defines functions and data.

## Contracts that span areas

- The API between `web/shared/api/client.js` and `server/http/routes.js`: change both sides, and their tests, in the same commit.
- Errors reach the page as codes from `server/errors.js` (`ApiError`). The page has text for each code it knows, so a new code needs that text too.
- Every word on the page is a key in both `shared/i18n/english.js` and `shared/i18n/spanish.js`. Every `$("id")` and `t("key")` in `web/` must exist; `tests/web/ui-structure.test.js` checks both.

## Privacy and safety

Never weaken these.

- Nothing about a person is stored: no database, no files, no `localStorage`, `sessionStorage`, cookies or IndexedDB. Page state lives in memory only.
- Server logs hold method, path, status, time and token counts. Never a request body, a paper or a question.
- Text goes to an AI only after the browser protects it with `shared/safety/`: `protect()` for a paper, and for a chat question `looksLikeInjection()` and then `redactText()` with the paper's token numbers. The server checks both again in `server/checks.js`. A new AI route goes through the same checks.
- Legal information, not advice. Page text never says "you should", "you must", "you need to" or "we recommend" (a test rejects them), and AI answers that do are flagged.
- Keys live only in `.env`, which git ignores. Never print, log or commit a key, or send it to the browser.
- The content security policy allows scripts from this site only. No CDN, no inline `<script>`, no `eval` or `new Function`. A browser library comes from `node_modules` through a `/vendor/` route in `server/http/static-files.js`.
- PDFs open with `isEvalSupported: false` (`shared/pdf-text.js`). Keep it.

## Tests

- `tests/` mirrors the code: `tests/shared/` tests `shared/`, `tests/server/` tests `server/`, `tests/web/` tests `web/`.
- Run the smallest relevant test file first, then `npm test` before you finish.
- Never delete, skip or loosen a failing test to get green. Fix the code, or explain why the test is wrong and let a person decide.
- New logic gets a test beside the existing ones for its area.

## Boundaries

- Always: run `npm test` before you say you are done.
- Ask first: a new dependency; a change to the API, the error codes or the security headers; anything that would store, log or send what a person enters.
- Never: commit `.env` or a key; add a script from another site; push. A person reviews the change and pushes it.

## Commits

- One logical change per commit, and the tests pass at every commit.
- Subject: `area: Imperative summary`, for example `web: Show the fix-by date on the clerk notice`. The area is `web`, `server`, `shared`, `tests`, `docs` or `ci`. No trailing period.
- Add a body only when the diff does not show why: a few plain sentences, as if telling a teammate. No bullet lists of changes, no headers.
- No `Co-Authored-By` or "Generated with" lines.
- Move or rename files with `git mv` so their history follows them.

## Code Review Rules

Flag these in review:
- a broken layout rule (`tests/layout.test.js` should already fail);
- one side of the API changed without the other;
- page text in only one language, or text that tells a person what to do in their case;
- anything stored, logged or sent that the privacy rules forbid;
- a new dependency, a script from another site, or an inline script;
- new logic without a test.

## Keeping these rules useful

- Do not edit AGENTS.md files during feature work. If you hit a trap these rules should warn about, add a "Suggested AGENTS.md additions" section to the pull request description, and the team decides.
- A new rule must be non-obvious, likely to happen again, and specific enough to act on. A rule for one area goes in that area's file.
- Rules are traps to avoid, not maps to follow. The map lives in README.md.
