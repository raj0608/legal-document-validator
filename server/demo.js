// `npm run demo`: the real site with sample answers instead of the AI. No key, no cost. See ai/adapters/demo-client.js.
import { createApp } from "./http/app.js";
import { createAnthropicAi } from "./ai/adapters/anthropic.js";
import { demoClient } from "./ai/adapters/demo-client.js";
import { createDemoLookup } from "./citations/demo-lookup.js";

const ai = createAnthropicAi({ client: demoClient(), model: "demo" });
const app = createApp({ ai, citations: createDemoLookup(), config: { demo: true, rateLimitPerMin: 600, dailyCap: 100000 } });
const port = Number(process.env.PORT) || 3000;
const server = app.listen(port, () => console.log(`DEMO of Let’s Get Ready for Court at http://localhost:${port} (sample answers, no AI)`));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => server.close(() => process.exit(0)));
