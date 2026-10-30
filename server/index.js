import Anthropic from "@anthropic-ai/sdk";
import { createApp } from "./app.js";
import { createAi } from "./anthropic.js";

const env = process.env;
// The key is read from the environment (ANTHROPIC_API_KEY) and used only in this process.
// AI_ENABLED=1 turns the helper on when credentials come from somewhere else, such as an `ant auth login` profile.
const hasCreds = Boolean(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN) || env.AI_ENABLED === "1";

const ai = hasCreds
  ? createAi({
      client: new Anthropic(),
      model: env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      effort: env.AI_EFFORT || "medium",
      fallback: env.AI_REFUSAL_FALLBACK === "1"
    })
  : null;

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
  console.log(ai ? `AI helper: on (${ai.model})` : "AI helper: off (no ANTHROPIC_API_KEY). Everything else still works.");
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => server.close(() => process.exit(0)));
