# server/: the Express server and the AI

Rules in the root AGENTS.md apply here too. This file only adds rules for `server/`.

- Test this area: `node --test "tests/server/*.test.js"`, then `npm test`.

## Traps

- The order in `server/http/app.js` is part of the security. Security headers come first, then the request log, then `/api` (no caching, health, the body size limit, the rate limit, the routes, 404, errors), then the page and the static files. New middleware goes into that order, never in front of the headers.
- An API route lives in `server/http/routes.js`. It checks its input with `server/checks.js`, which fails closed, and it fails by throwing an `ApiError` from `server/errors.js`. The browser gets only the code. Log an error's name, never its message: messages can echo what a person typed.
- The AI is passed in. Apart from the start files `server/main.js` and `server/demo.js`, code outside `server/ai/` calls only `ai.stream` and `ai.json`, as described in `server/ai/port.js`, and never imports from `server/ai/` or an AI SDK.
- A new AI provider is one file in `server/ai/adapters/` that implements `port.js` and turns its own SDK's errors into `ApiError` codes, plus one branch in `server/ai/choose.js`. Nothing in `server/http/` changes.
- Per-app state (rate limits, the daily cap, the translation cache) is created inside `createApp`, never at module level, so each test gets a fresh app.
- Settings come from the environment through `server/config.js` and `server/ai/choose.js`. A new setting also goes in `.env.example` and the Settings table in README.md.
- The rules and the delimiter around the paper live in `server/prompts.js`, and the browser cannot change them. The delimiter gets a fresh random value for each request; keep it that way.

## Code Review Rules

- A route that skips `checks.js`, or a log line that could hold a body.
- An import of `server/ai/` from anywhere but `server/main.js` and `server/demo.js`.
- Any change to the content security policy in `server/http/security-headers.js`.
