// The only file that talks to the Anthropic API. The key never leaves the server.
import Anthropic from "@anthropic-ai/sdk";
import { ApiError } from "../../errors.js";
import { parseJson } from "../json.js";

// Turns an SDK error into one of the codes the page already knows how to show.
export function mapError(err, text) {
  if (err instanceof ApiError) return err;
  const extra = text ? { text } : {};
  if (err instanceof Anthropic.APIUserAbortError) return new ApiError("cancelled", 499, extra);
  if (err instanceof Anthropic.RateLimitError) return new ApiError("rate_limited", 429, extra);
  // A missing or rejected key is a setup problem, not something the person can fix: the page turns the helper off.
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) return new ApiError("unavailable", 503, extra);
  return new ApiError("generic", 502, extra);
}

/** @returns {import("../port.js").Ai} */
export function createAnthropicAi({ client, model, effort = "medium", fallback = false }) {
  async function stream({ system, messages, maxTokens = 16000, signal, onText }) {
    const base = { model, max_tokens: maxTokens, system, messages, output_config: { effort } };
    let text = "";
    let message;
    try {
      // With fallback on, a safety refusal is retried by the API on another model inside the same call.
      const s = fallback
        ? client.beta.messages.stream({ ...base, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }, { signal })
        : client.messages.stream(base, { signal });
      s.on("text", (delta) => { text += delta; if (onText) onText(delta); });
      message = await s.finalMessage();
    } catch (err) { throw mapError(err, text); }
    if (message.stop_reason === "refusal") throw new ApiError("refused", 422, text ? { text } : {});
    return { text, truncated: message.stop_reason === "max_tokens", usage: message.usage };
  }
  async function json(req) {
    const r = await stream(req);
    if (r.truncated) throw new ApiError("invalid_json", 502);
    return { data: parseJson(r.text), usage: r.usage };
  }
  return { stream, json, model };
}
