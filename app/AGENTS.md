# app/: the browser app

Rules in the root AGENTS.md apply here too. This file only adds rules for `app/`.

- Test this area: `node --test tests/app/ui-structure.test.js`, then `npm test`.
- See it: `npm run demo`, open http://localhost:3000, and reload after each edit. The browser keeps modules until you do.

## Traps

- `app/main.js` calls each screen's `init...` and `render...` functions in a fixed order, and that order is behavior: listeners are added and text is drawn in it. Add a new call next to its neighbours, not at the end.
- Markup lives in `view.html` files. `app/index.html` pulls each one in with a line that holds only `<!-- include: /app/... -->`. If an included file is missing, the page refuses to load, and the server's console names the file.
- `tests/app/ui-structure.test.js` finds sections by their HTML comments, for example `<!-- Check my form -->` at the top of `screens/check/view.html`. Keep those comments.
- Put text on the page with `textContent` or `el()` from `app/shared/lib/dom.js`. Use `innerHTML` only with the output of `app/shared/lib/answer-html.js`, which escapes first. AI answers and paper text are untrusted.
- Page state is `app/shared/state.js`, in memory only. A person may be on a shared or watched computer, and "Hide this page" must leave nothing behind.
- The stylesheets in `app/styles/` are linked in a fixed order in `index.html`, and that order is the cascade. Add a rule to the file for that part of the page; do not reorder the links.
- The line `<!-- modulepreload: /app/main.js -->` makes the page ask for every module at once. The server follows the imports, so there is nothing to keep in sync, but every file in `app/` must be imported by something `main.js` loads (`tests/server/page.test.js` checks this).
- The server sends only `.js` and `.css` files from `app/` and `shared/` (`server/http/static-files.js`), so markup and notes like AGENTS.md stay off the site. A new kind of file the page loads, such as an image, needs its extension added there.
- pdf.js loads only when someone picks a PDF (`app/shared/lib/read-pdf.js`). Never import it at the top of a file: it is large, and most people never need it.
- Steps 1 to 3 of My papers never link out of the path. A test checks this.

## Code Review Rules

- A screen that imports another screen's `components/` or `lib/`.
- `innerHTML` with anything that did not come from `answer-html.js`.
- Anything written to browser storage.
