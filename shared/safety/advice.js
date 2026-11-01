// ---------- "Should/must" detector for model replies ----------
// The detector below is lexical, so it also fires on the sentence the rules REQUIRE when someone asks for advice
// ("I can't advise you on what you should do") and on a reply that says the paper does not state "whether you should…".
// Warning someone about the very reply that refuses to advise them is confusing and teaches them to ignore the warning.
// So these exact constructions, and only these, are set aside before testing. Anything else in the sentence still counts:
// "I can't advise you on what you should do, but you should file a motion" is still flagged (by the second "you should").
const REFUSALS = [
  /\b(?:can(?:not|['’]t)|can not|am unable to|am not able to)\s+(?:advise|tell|say)(?:\s+you)?\s+(?:on\s+|about\s+)?(?:what|whether|if)\s+you\s+(?:should|must|need to)(?:\s+do)?\b/gi,
  /\b(?:do|does|did)(?:n['’]t|\s+not)\s+(?:say|state|tell|specify|address|explain|mention)\s+(?:what|whether|if)\s+you\s+(?:should|must|need to)\b/gi,
  /\bno puedo\s+(?:aconsejar|asesorar|decir)(?:le|te)?\s+(?:sobre\s+)?(?:qu[eé]|lo que|si)\s+(?:usted\s+)?(?:deber[ií]a(?:s|n)?|debe(?:s|n)?)(?:\s+hacer)?/gi,
  /\bno\s+(?:dice|dicen|indica|indican|establece|establecen|especifica|especifican)\s+(?:qu[eé]|lo que|si)\s+(?:usted\s+)?(?:deber[ií]a(?:s|n)?|debe(?:s|n)?)/gi
];
export function looksLikeAdvice(text) {
  let s = String(text);
  for (const re of REFUSALS) s = s.replace(re, " ");
  return ADVICE.test(s);
}

export const ADVICE = new RegExp([
  "\\b(you should|you shouldn['’]t|you must|you need to|i recommend|i suggest|i advise|my advice)\\b",
  "deber[ií]a(?:s|n)?\\b|le recomiendo|te recomiendo|le sugiero|le aconsejo",
  "vous devriez|je vous recommande|você deveria|você deve|recomendo que|sie sollten|ich empfehle|dovresti|dovrebbe|ti consiglio",
  "bạn nên|你应该|您应该|你應該|您應該|建议您|建議您|해야 합니다|하셔야|추천합니다|вам следует|вы должны|рекомендую",
  "ou ta dwe|ou dwe|आपको चाहिए|सलाह देता|powinien|powinna|powinieneś|べきです|することをお勧め|يجب عليك|ينبغي|أنصحك|باید|آپ کو چاہیے"
].join("|"), "i");
