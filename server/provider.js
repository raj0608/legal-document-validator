// Which AI to use, decided from the environment (.env). Gemini is the default for this prototype because it has a free tier.
//
//   AI_PROVIDER=gemini      GEMINI_API_KEY=...       GEMINI_MODEL=gemini-3.5-flash-lite
//   AI_PROVIDER=anthropic   ANTHROPIC_API_KEY=...    ANTHROPIC_MODEL=claude-sonnet-5-5
//
// With AI_PROVIDER unset, whichever key is present is used (Gemini first if both are). With no key the AI is off and
// everything else still works. `choose` only decides; `build` creates the connection.
import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { createAi } from "./anthropic.js";
import { createGeminiAi } from "./gemini.js";

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite"; // the current stable "basic" model, available on Google's free tier

export function choose(env) {
  const gemini = Boolean(env.GEMINI_API_KEY);
  const anthropic = Boolean(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN) || env.AI_ENABLED === "1";
  const asked = (env.AI_PROVIDER || "").toLowerCase();
  if (asked && asked !== "gemini" && asked !== "anthropic") return { name: null, why: `AI_PROVIDER=${env.AI_PROVIDER} is not one of: gemini, anthropic` };
  const name = asked || (gemini ? "gemini" : anthropic ? "anthropic" : null);
  if (name === "gemini" && !gemini) return { name: null, why: "AI_PROVIDER=gemini but GEMINI_API_KEY is empty" };
  if (name === "anthropic" && !anthropic) return { name: null, why: "AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is empty" };
  if (!name) return { name: null, why: "no API key set" };
  return { name };
}

export function build(env, pick = choose(env)) {
  if (pick.name === "gemini") {
    return createGeminiAi({
      client: new GoogleGenAI({ apiKey: env.GEMINI_API_KEY }),
      model: env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
      thinkingLevel: env.GEMINI_THINKING_LEVEL || ""
    });
  }
  if (pick.name === "anthropic") {
    const ai = createAi({
      client: new Anthropic(),
      model: env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      effort: env.AI_EFFORT || "medium",
      fallback: env.AI_REFUSAL_FALLBACK === "1"
    });
    return Object.assign(ai, { provider: "anthropic" });
  }
  return null;
}
