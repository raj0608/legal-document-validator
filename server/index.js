import { createApp } from "./app.js";
import { choose, build } from "./provider.js";

const env = process.env;
// Which AI (Gemini or Anthropic) and its key come from .env: see server/provider.js. The key stays in this process.
const pick = choose(env);
const ai = build(env, pick);

const num = (v, d) => (v !== undefined && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : d);
const app = createApp({
  ai,
  config: {
    rateLimitPerMin: num(env.RATE_LIMIT_PER_MIN, 20),
    dailyCap: num(env.DAILY_REQUEST_CAP, 2000),
    // Set to the number of proxies in front of the server (1 on most hosts) so rate limits use the real client address.
    trustProxy: env.TRUST_PROXY === undefined ? undefined : (Number.isNaN(Number(env.TRUST_PROXY)) ? env.TRUST_PROXY : Number(env.TRUST_PROXY))
  }
});

const port = num(env.PORT, 3000);
const server = app.listen(port, () => {
  console.log(`Let’s Get Ready for Court is running at http://localhost:${port}`);
  console.log(ai ? `AI helper: on (${ai.provider}: ${ai.model})` : `AI helper: off (${pick.why}). Everything else still works.`);
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => server.close(() => process.exit(0)));
