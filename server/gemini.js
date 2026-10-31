// Google Gemini as the AI. Same shape as anthropic.js: { stream, json, model, provider }, so the rest of the server
// does not know which AI it is talking to. The key never leaves the server.
//
// API shape (checked against @google/genai 2.32 and Google's docs, 2026-10-31):
//   ai.models.generateContentStream({ model, contents: [{ role: "user" | "model", parts: [{ text }] }], config })
//   config: systemInstruction, maxOutputTokens, responseMimeType, thinkingConfig.thinkingLevel, abortSignal
//   each chunk: .text, .candidates[0].finishReason, .promptFeedback.blockReason, .usageMetadata
import { ApiError as GeminiApiError } from "@google/genai";
import { ApiError } from "./errors.js";
import { parseJson } from "./json.js";

// Why Gemini stopped for a safety reason: the answer was withheld.
const WITHHELD = new Set(["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "LANGUAGE"]);

// Turns an SDK error into one of the codes the page already knows how to show.
export function mapGeminiError(err, text, signal) {
  if (err instanceof ApiError) return err;
  const extra = text ? { text } : {};
  if ((signal && signal.aborted) || (err && err.name === "AbortError")) return new ApiError("cancelled", 499, extra);
  const status = err instanceof GeminiApiError || typeof (err && err.status) === "number" ? err.status : 0;
  if (status === 429) return new ApiError("rate_limited", 429, extra);
  // A missing, wrong or switched-off key is a setup problem: the page turns the helper off.
  // Google reports a bad key as 400 (not 401), so the wording has to be checked for that one.
  if (status === 401 || status === 403 || (status === 400 && /api key|API_KEY_INVALID/i.test(String(err.message)))) return new ApiError("unavailable", 503, extra);
  return new ApiError("generic", 502, extra);
}

// Our messages use "assistant"; Gemini calls it "model". Back-to-back turns from one side are joined, which Gemini prefers.
export function toContents(messages) {
  const out = [];
  for (const m of messages) {
    const role = m.role === "assistant" ? "model" : "user";
    const last = out[out.length - 1];
    if (last && last.role === role) last.parts[0].text += "\n\n" + m.content;
    else out.push({ role, parts: [{ text: m.content }] });
  }
  return out;
}

export function createGeminiAi({ client, model, thinkingLevel = "", maxOutputTokens = 32768 }) {
  async function stream({ system, messages, maxTokens = 16000, signal, onText, asJson = false }) {
    const config = { maxOutputTokens: Math.min(maxTokens, maxOutputTokens), abortSignal: signal };
    if (system) config.systemInstruction = system;
    if (asJson) config.responseMimeType = "application/json";
    // Only set when asked: some models do not take a thinking level. The default is the model's own (minimal on 3.5 Flash-Lite).
    if (thinkingLevel) config.thinkingConfig = { thinkingLevel: thinkingLevel.toUpperCase() };

    let text = "", finish = "", blocked = "", usage;
    try {
      const chunks = await client.models.generateContentStream({ model, contents: toContents(messages), config });
      for await (const chunk of chunks) {
        const delta = chunk.text;
        if (delta) { text += delta; if (onText) onText(delta); }
        const cand = chunk.candidates && chunk.candidates[0];
        if (cand && cand.finishReason) finish = cand.finishReason;
        if (chunk.promptFeedback && chunk.promptFeedback.blockReason) blocked = chunk.promptFeedback.blockReason;
        if (chunk.usageMetadata) usage = chunk.usageMetadata;
      }
    } catch (err) { throw mapGeminiError(err, text, signal); }

    if (blocked || WITHHELD.has(finish)) throw new ApiError("refused", 422, text ? { text } : {});
    if (!text.trim()) throw new ApiError("generic", 502); // nothing came back, and nothing said why
    return {
      text,
      truncated: finish === "MAX_TOKENS",
      usage: usage && { input_tokens: usage.promptTokenCount, output_tokens: usage.candidatesTokenCount }
    };
  }

  async function json(req) {
    const r = await stream({ ...req, asJson: true });
    if (r.truncated) throw new ApiError("invalid_json", 502);
    return { data: parseJson(r.text), usage: r.usage };
  }
  return { stream, json, model, provider: "gemini" };
}
