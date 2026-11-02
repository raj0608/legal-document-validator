# Contributing

Five of us work on this code, often with AI coding tools. The rules are short, and `npm test` checks most of them.

## Setup

You need Node 22.13 or newer.

```sh
npm install
npm run demo     # the site with sample answers and no key: http://localhost:3000
npm test         # every check, a few seconds, no key needed
```

`npm run dev` runs the site with the real AI. README.md explains the `.env` file it reads.

## Where code goes

The folder map and the rules behind it are in README.md, under "How it is put together". In short:
- one concern per file, named for what it holds;
- a page is the folder of its address in `app/`, so `#check` is `app/check/` and `#help/privacy` is `app/help/privacy/`;
- code that two pages use goes in `app/shared/`, and code the server uses too goes in `shared/`;
- the AI sits behind `server/ai/port.js`.

`tests/layout.test.js` fails when a rule breaks, and its message names the file.

## Commits

- One logical change per commit, and the tests pass at each one.
- The subject is `area: Imperative summary`, for example `app: Show the fix-by date on the clerk notice`. The areas are `app`, `server`, `shared`, `tests`, `docs` and `ci`.
- Add a body only when the diff does not show why. Write a few plain sentences, as if telling a teammate, not a list of changes.
- Move files with `git mv` so their history follows them.
- Pull before you start, and push small changes often. CI runs `npm test` and `npm audit` on every push and pull request.

## AI coding tools

Every tool reads the same rules: `AGENTS.md` at the root, plus `app/AGENTS.md`, `server/AGENTS.md` and `shared/AGENTS.md` for those folders. Each `CLAUDE.md` is a one-line stub that points Claude Code at the AGENTS.md beside it, and `.gemini/settings.json` does the same for Gemini CLI. Start your tool at the repo root.

- Do not add a rule file for one tool, such as `.cursorrules`, `.rules`, `GEMINI.md` or `.github/copilot-instructions.md`. Some tools read only one file, so a new one can hide AGENTS.md from them. `tests/agent-rules.test.js` rejects them.
- Do not turn rule files into symlinks. On Windows they check out as one-line text files.
- If you hit a trap the rules should warn about, add a "Suggested AGENTS.md additions" section to your pull request description, and we decide together. Rules are traps to avoid, not a tour of the code.
- Read what your tool wrote before you commit it. `npm test` catches a broken layout, not wrong behavior.

## Keys and real papers

Never commit `.env` or a key. If one is ever pushed, revoke it at once. When the AI is on, use the sample papers, not real ones.
