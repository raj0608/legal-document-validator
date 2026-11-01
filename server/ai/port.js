// The contract every AI provider implements: the only part of an AI that server/http and translate.js use.

/**
 * One call to the AI.
 * @typedef {object} AiRequest
 * @property {string} [system] the rules, from prompts.js
 * @property {{ role: "user" | "assistant", content: string }[]} messages
 * @property {number} [maxTokens] the longest answer wanted (16000 when not given)
 * @property {AbortSignal} [signal] stops the call, for example when the person leaves the page
 * @property {(text: string) => void} [onText] called with each piece of the answer as it arrives
 */

/**
 * A finished answer.
 * @typedef {object} AiAnswer
 * @property {string} text
 * @property {boolean} truncated true when the answer was cut off at maxTokens
 * @property {{ input_tokens: number, output_tokens: number } | undefined} usage token counts, for the request log
 */

/**
 * An AI provider, as each file in adapters/ builds it.
 * Every failure is thrown as an ApiError from server/errors.js, with one of the codes the page knows:
 * cancelled 499, rate_limited 429, unavailable 503 (missing or rejected key), refused 422, invalid_json 502, generic 502.
 * When part of an answer arrived before the failure, the error carries it as `text`.
 * @typedef {object} Ai
 * @property {(req: AiRequest) => Promise<AiAnswer>} stream
 * @property {(req: AiRequest) => Promise<{ data: unknown, usage: AiAnswer["usage"] }>} json the answer read as JSON
 * @property {string} model
 * @property {string} [provider] the provider's name, reported by /api/health
 */
