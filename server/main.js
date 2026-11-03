// `npm start` and `npm run dev`: the server, with the AI and the limits that .env asks for.
import { createApp } from "./http/app.js";
import { choose, build } from "./ai/choose.js";
import { createCourtListener } from "./citations/courtlistener.js";
import { readConfig, readPort } from "./config.js";

const env = process.env;
// Which AI (Gemini or Anthropic) and its key come from .env: see server/ai/choose.js. The key stays in this process.
const pick = choose(env);
const ai = build(env, pick);

// The citation lookup for the court staff page needs a free CourtListener token. Without one that page lists citations but checks none.
const citations = env.COURTLISTENER_TOKEN ? createCourtListener({ token: env.COURTLISTENER_TOKEN }) : null;

const app = createApp({ ai, citations, config: readConfig(env) });

const port = readPort(env);
const server = app.listen(port, () => {
  console.log(`Let’s Get Ready for Court is running at http://localhost:${port}`);
  console.log(ai ? `AI helper: on (${ai.provider}: ${ai.model})` : `AI helper: off (${pick.why}). Everything else still works.`);
  console.log(citations ? "Citation lookup: on (CourtListener)" : "Citation lookup: off (no COURTLISTENER_TOKEN). The court staff page lists citations but checks none.");
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => server.close(() => process.exit(0)));
