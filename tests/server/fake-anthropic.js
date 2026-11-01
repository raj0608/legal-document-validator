// A fake Anthropic client and a test server around it: no network, no key.
import Anthropic from "@anthropic-ai/sdk";
import { createApp } from "../../server/http/app.js";
import { createAnthropicAi } from "../../server/ai/adapters/anthropic.js";
import { protect } from "../../shared/safety/protect.js";

export const open = new Set();
export const shutdown = (server) => new Promise((r) => { open.delete(server); server.closeAllConnections(); server.close(() => r()); });

// A stand-in for the SDK client. `script(params)` says what the "model" does.
export function fakeClient(script) {
  const calls = [];
  return {
    calls,
    messages: {
      stream(params, opts = {}) {
        calls.push(params);
        const handlers = [];
        return {
          on(ev, fn) { if (ev === "text") handlers.push(fn); return this; },
          async finalMessage() {
            const s = script(params);
            if (opts.signal && opts.signal.aborted) throw new Anthropic.APIUserAbortError();
            for (const d of s.deltas || []) handlers.forEach((h) => h(d));
            if (s.error) throw s.error;
            return { stop_reason: s.stop || "end_turn", usage: { input_tokens: 10, output_tokens: 5 } };
          }
        };
      }
    }
  };
}

export async function start({ script = () => ({ deltas: ["ok"] }), ai = true, config = {} } = {}) {
  const client = fakeClient(script);
  const app = createApp({ ai: ai ? createAnthropicAi({ client, model: "test-model", effort: "medium" }) : null, config: { log: false, ...config } });
  const server = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  open.add(server);
  const base = "http://127.0.0.1:" + server.address().port;
  const post = (path, body) => fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { client, base, post, get: (p) => fetch(base + p), close: () => shutdown(server) };
}

export async function readSse(res) {
  const events = [];
  for (const block of (await res.text()).split("\n\n")) {
    const m = /^event: (\w+)\ndata: (.*)$/s.exec(block.trim());
    if (m) events.push({ event: m[1], data: JSON.parse(m[2]) });
  }
  return events;
}
export const doc = (text) => ({ safe: protect(text).safe });
