# shared/: plain code for the browser, the server and the tests

Rules in the root AGENTS.md apply here too. This file only adds rules for `shared/`.

- Test this area: `node --test "tests/shared/*.test.js"`, then `npm test`.

## Traps

- The same file runs in the browser, in Node and in the tests. Never use `document`, `window`, `fetch`, `process`, `Buffer` or `require`; pass what a function needs as arguments. `pdf-text.js`, for example, is handed pdf.js instead of importing it.
- Loading a file never does anything. Export functions and data only.
- Dates are calendar days, not moments. Use `fromISO` and `toISO` from `shared/dates/date-math.js`. `new Date("2026-11-02")` means midnight UTC, which is still November 1 in Indiana.
- `protect()` in `safety/protect.js` removes instruction-like text first and replaces private details second. Keep that order.
- A new kind of private detail goes in `safety/redaction.js` only. The browser's `protect()` and the server's `findResidualPii` both use it, and the server rejects a request in which it still finds one.
- `english.js` and `spanish.js` hold the same keys. Write page text in plain words, and never tell a person what to do in their own case.
- Court holidays in `dates/holidays.js` are tested against the court's published list in `tests/fixtures/court-holidays-published.json`. Update both together.
- `pdf-text.js` always opens PDFs with `isEvalSupported: false`, and a caller cannot turn it back on. A test checks this.

## Code Review Rules

- An import from outside `shared/`, or a browser or Node global.
- A change to `safety/` without a matching case in `tests/golden/cases.js` or `tests/shared/safety.test.js`.
