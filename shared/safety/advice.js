// ---------- "Should/must" detector for model replies ----------
import { INVISIBLE } from "./injection-filter.js";

// The detector below is lexical, so it also fires on the sentence the rules REQUIRE when someone asks for advice
// ("I can't advise you on what you should do") and on a reply that says the paper does not state "whether you should…".
// Warning someone about the very reply that refuses to advise them is confusing and teaches them to ignore the warning.
// So these exact constructions, and only these, are set aside before testing. Anything else in the sentence still counts:
// "I can't advise you on what you should do, but you should file a motion" is still flagged (by the second "you should").
const REFUSALS = [
  /\b(?:can(?:not|['’]t)|can not|am unable to|am not able to)\s+(?:advise|tell|say)(?:\s+you)?\s+(?:on\s+|about\s+)?(?:what|whether|if)\s+you\s+(?:should|must|need to)(?:\s+do)?\b/gi,
  /\b(?:do|does|did)(?:n['’]t|\s+not)\s+(?:say|state|tell|specify|address|explain|mention)\s+(?:what|whether|if)\s+you\s+(?:should|must|need to)\b/gi,
  /\bno puedo\s+(?:aconsejar|asesorar|decir)(?:le|te)?\s+(?:sobre\s+)?(?:qu[eé]|lo que|si)\s+(?:usted\s+)?(?:deber[ií]a(?:s|n)?|debe(?:s|n)?)(?:\s+hacer)?/gi,
  /\bno\s+(?:dice|dicen|indica|indican|establece|establecen|especifica|especifican)\s+(?:qu[eé]|lo que|si)\s+(?:usted\s+)?(?:deber[ií]a(?:s|n)?|debe(?:s|n)?)/gi,
  // Tagalog: "Hindi ko masabi kung dapat kang lumipat o hindi" (I can't say whether you should move or not)
  /\bhindi ko (?:masabi|masasabi|maibibigay|maipapayo)[^.!?]{0,80}?\bdapat (?:kang|mong|ninyong) \S+(?: o hindi)?/gi,
  // Burmese: "...ဘာလုပ်ရမယ်ဆိုတာကို ... အကြံဉာဏ်ပေးလို့ မရပါ" (I cannot give advice on what to do)
  /[^။]{0,60}အကြံ(?:ဉာဏ်)?\s*ပေးလို့\s*မရပါ(?:ဘူး)?/g
];
export function looksLikeAdvice(text) {
  // invisible characters and odd spaces (a non-breaking space, a zero-width space) must not hide a phrase
  let s = String(text).replace(INVISIBLE, "").replace(/\s+/g, " ");
  for (const re of REFUSALS) s = s.replace(re, " ");
  return ADVICE.test(s);
}

// Words that tell a person what to do. Each group is one kind of phrasing or one language; the detector fires on any of them.
// The languages from Tagalog on were written without a native reviewer: a person who reads each one should check them (see data/ and the README).
const GROUPS = {
  // "you should", and the other ways English tells someone what to do or gives a recommendation
  english: [
    "\\b(you should|you shouldn['’]t|you must|you need to|you have to|you ought to|you['’]d better|you had better|you may want to|you might want to|you could consider)\\b",
    "\\b(i recommend|i suggest|i advise|i urge|we recommend|we suggest|we advise|i['’]d recommend|i would recommend|i['’]d suggest|i would suggest|i['’]d advise|i would advise|my advice|my recommendation|my suggestion)\\b",
    "\\b(if i were you|in your (?:shoes|position|place)|it is advisable|it['’]s advisable|it would be (?:wise|best|better|smart|a good idea) to|it is (?:wise|best|better|a good idea) to|the best (?:course of action|option|approach|thing to do|move)|your best (?:option|bet|move|course))\\b",
    "\\bconsider (?:filing|asking|requesting|hiring|paying|moving|contacting|getting|sending|signing|challenging)\\b",
    // about a person in the third person: "Tenants should file", "The defendant ought to ask"
    "\\b(?:tenants?|renters?|defendants?|litigants?|people|parties|persons?|one|the (?:tenant|renter|defendant|litigant|person)|a (?:tenant|renter|defendant|litigant|person))\\s+(?:should(?:n['’]t)?|ought to|would be wise to|is advised to|are advised to|had better)\\b"
  ],
  spanish: ["deber[ií]a(?:s|n)?\\b|le recomiendo|te recomiendo|le sugiero|le aconsejo"],
  european: ["vous devriez|je vous recommande|você deveria|você deve|recomendo que|sie sollten|ich empfehle|dovresti|dovrebbe|ti consiglio"],
  east_asian_russian: ["bạn nên|你应该|您应该|你應該|您應該|建议您|建議您|해야 합니다|하셔야|추천합니다|вам следует|вы должны|рекомендую"],
  other_original: ["ou ta dwe|ou dwe|आपको चाहिए|सलाह देता|powinien|powinna|powinieneś|べきです|することをお勧め|يجب عليك|ينبغي|أنصحك|باید|آپ کو چاہیے"],
  // the languages the first version did not cover
  tagalog: ["dapat (?:mong|kang|ninyong|ka)\\b|kailangan (?:mong|ninyong|kang)\\b|inirerekomenda ko|iminumungkahi ko|(?:ang )?payo ko\\b"],
  somali: ["waa in(?:aad| aad)\\b|waxaan (?:kugula talinayaa|kuu soo jeedinayaa|kugula talinayaa)|waxaan kugula talin"],
  burmese: ["သင့်(?:သည်|ပါသည်|ပါတယ်|တယ်)|အကြံပြု|အကြံပေး|လုပ်ရ(?:မည်|မယ်)"],
  bengali: ["আপনার উচিত|উচিত\\b|আপনাকে[^।]{0,40}হবে|আমি (?:পরামর্শ|সুপারিশ) (?:দিই|দিচ্ছি|করি)"],
  gujarati: ["તમારે[^.\\n]{0,60}(?:જોઈએ|પડશે)|હું ભલામણ કરું|સલાહ આપું"],
  punjabi: ["ਤੁਹਾਨੂੰ[^।.\\n]{0,60}(?:ਚਾਹੀਦ|ਪਵੇਗਾ)|ਮੈਂ (?:ਸਿਫਾਰਸ਼|ਸਿਫ਼ਾਰਸ਼) ਕਰਦ|ਸਲਾਹ ਦਿੰਦ"],
  nepali: ["तपाईंले[^।.\\n]{0,60}(?:पर्छ|पर्दछ|पर्नेछ|नुपर्छ)|गर्नुपर्छ|(?:सल्लाह|सुझाव) दिन्छु"],
  amharic: ["አለብዎ?ት|አለብህ|አለብሽ|ይገባዎታል|ይገባሃል|እመክር"]
};

export const ADVICE = new RegExp(Object.values(GROUPS).flat().join("|"), "i");
export const ADVICE_LANGUAGES = Object.keys(GROUPS);
