// `npm start` and `npm run dev`: the server, with the AI and the limits that .env asks for.
import { createApp } from "./http/app.js";
import { choose, build } from "./provider.js";
import { readConfig, readPort } from "./config.js";

const env = process.env;
// Which AI (Gemini or Anthropic) and its key come from .env: see server/provider.js. The key stays in this process.
const pick = choose(env);
const ai = build(env, pick);

const app = createApp({ ai, config: readConfig(env) });

const port = readPort(env);
const server = app.listen(port, () => {
  console.log(`Let’s Get Ready for Court is running at http://localhost:${port}`);
  console.log(ai ? `AI helper: on (${ai.provider}: ${ai.model})` : `AI helper: off (${pick.why}). Everything else still works.`);
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => server.close(() => process.exit(0)));
