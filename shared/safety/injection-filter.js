// ---------- Injection filter ----------
export const INVISIBLE = /[​-‏‪-‮⁠-⁤﻿­]/g;
export const INJ = [
  /\b(ignore|disregard|forget|override|bypass)\b[^\n]{0,60}\b(instructions?|rules?|prompts?|guidelines|polic(?:y|ies)|above|previous|prior|system)\b/i,
  /\b(you are now|act as|pretend (?:to be|you are)|roleplay as|new instructions|system prompt|developer mode|jailbreak|do anything now)\b/i,
  /<\/?\s*(system|assistant|user|instructions?|prompt)\s*>/i,
  /^\s*(system|assistant|developer)\s*:/i,
  /\b(note|message|instructions?)\s+(to|for)\s+(the\s+)?(ai|assistant|model|chatbot|llm)s?\b/i,
  /\b(tell|advise|recommend|instruct)\s+(the\s+)?(user|tenant|reader|person)\s+(to|that)\b/i
];
export const INJ_LINE = "[Removed: text that looked like instructions to an AI]";
export function looksLikeInjection(s) { return INJ.some((r) => r.test(s.replace(INVISIBLE, ""))); }
export function sanitize(text) {
  let removed = 0;
  const lines = text.replace(INVISIBLE, "").split("\n").map((line) => {
    if (!looksLikeInjection(line)) return line;
    if (/^\s*(system|assistant|developer)\s*:/i.test(line.replace(INVISIBLE, ""))) { removed++; return INJ_LINE; }
    const parts = line.split(/(?<=[.!?])\s+/);
    return parts.map((p) => { if (looksLikeInjection(p)) { removed++; return INJ_LINE; } return p; }).join(" ");
  });
  return { text: lines.join("\n"), removed };
}
