// ---------- Does a question ask for legal advice? ----------
// Telling a person what to do in their own case is legal advice. When a question asks for exactly that ("Should I stop paying
// rent?", "What would you do?", "Do I have a case?", "Write my answer"), the site answers with a fixed refusal and pointers to free
// help, without asking the AI at all. A question about what a paper says, what a word means, or what the law requires is not
// advice and is never caught here: "What should I bring to the hearing?" and "Do I have to appear?" go on to the AI.
//
// English and Spanish only. A question in any other language goes to the AI, which is told never to advise, and its answer is
// checked by the advice warning. Both lists lean towards catching: a question that is only a little like advice gets the refusal.
import { INVISIBLE } from "./injection-filter.js";

// "should I ..." is advice unless it asks what to bring, what to expect or what to know. "What should I bring?" is information (the paper lists
// it) and "Should I bring my lease?" is too, but "Should I bring a witness?" is a decision about the case.
const INFO_WORDS = "expect|know|wear|arrive|read|look for|check for|be (?:prepared|ready)|do to prepare|have with me|have ready";
const DOCS = "(?:my |the |a |any |all )?(?:lease|documents?|papers?|paperwork|id|identification|copies|receipts?|notice|summons|messages|texts)";

const EN = [
  "\\bwhat (?:should|shall) i\\b(?!\\s+(?:bring|take|" + INFO_WORDS + "))",
  "(?<!\\bwhat )\\b(?:should|shall) i\\b(?!\\s+(?:" + INFO_WORDS + "|bring " + DOCS + "))",
  "\\bwhat (?:do|shall) i do (?:now|next|here|about (?:this|it|that))\\b|\\bwhat do i do\\b",
  "\\bwhat (?:would|do) you (?:do|recommend|suggest|advise|think i should)\\b|\\bif you were me\\b|\\bin my (?:place|shoes|position)\\b",
  "\\b(?:do you think|would you say|you think|you recommend) (?:i|that i) (?:should|must|need to|ought to)\\b",
  "\\bdo i have (?:a|any) (?:case|defense|defence|chance|chances|grounds|claim|argument)\\b",
  "\\b(?:will|would|can|could) i (?:win|lose|beat|get away)\\b|\\bam i (?:going to|gonna) (?:win|lose)\\b|\\bhow likely am i\\b",
  "\\bwhat(?:'s| is| are) my (?:chances|odds|best (?:defense|defence|option|options|move|strategy|argument|course))\\b",
  "\\b(?:is it|would it be|is that) (?:ok|okay|safe|smart|wise|a good idea|better|fine|alright|worth it) to\\b",
  "\\bdo i (?:really )?(?:need|have) (?:a |an |to hire (?:a |an )?|to get (?:a |an )?)(?:lawyer|attorney)\\b",
  "\\bcan i (?:just )?(?:ignore|skip|stop paying|withhold|not (?:pay|go|show|appear|answer|respond))\\b",
  "\\b(?:tell|show|teach) me (?:exactly )?(?:what|how) to (?:write|say|do|file|respond|answer|argue|fill)\\b",
  "\\b(?:write|draft|prepare|compose|fill (?:in|out)) (?:my|the|a|an|this|that) (?:answer|response|motion|letter|brief|complaint|counterclaim|reply|affidavit|defense|defence|form|filing)\\b",
  "\\b(?:help me|can you|could you|please) (?:write|draft|fill|prepare|respond)\\b",
  "\\b(?:pretend|act|behave|imagine|roleplay|role-play) (?:you(?:'re| are)|as|like|that you(?:'re| are)) (?:my|a|an) (?:lawyer|attorney|judge)\\b|\\b(?:be|become) my (?:lawyer|attorney)\\b",
  "\\b(?:give|need|want|get) (?:me )?(?:some )?legal advice\\b",
  // somebody else in the same spot, a pretend case, or pressure
  "\\bshould (?:my (?:friend|sister|brother|mom|mother|dad|father|wife|husband|partner|neighbor|neighbour|roommate)|a tenant|the tenant|tenants|someone|somebody|he|she|they|we|a person|people)\\b",
  "\\b(?:hypothetical(?:ly)?|off the record|just this once)\\b[^.?!]{0,80}\\b(?:should|would you|what would|tell me)\\b",
  "\\b(?:tell|advise) me (?:whether|if) to\\b|\\badvise me\\b|\\btell me if i (?:will|would|should) (?:win|lose)\\b",
  // predictions, and "pick one for me"
  "\\b(?:predict|forecast|guess)\\b[^.?!]{0,40}\\b(?:case|outcome|turn out|result)\\b|\\bhow (?:my|the) case will (?:turn out|go|end)\\b",
  "\\bis (?:my|the) landlord (?:going to|gonna) win\\b|\\bwill (?:the )?(?:judge|court) (?:rule|decide) (?:for|against) me\\b",
  // more ways of asking "what is the smart thing to do"
  "\\b(?:best|smartest|right|wise|wisest|safest|sensible|better) (?:thing|move|step|choice|option|call) (?:to do|for me|here)\\b|\\b(?:best|smartest|right|wise|safest|sensible) (?:way|approach|strategy) to (?:handle|deal with|respond|fight|proceed|approach|get out of)\\b",
  "\\bwhat(?:'s| is) (?:the )?(?:smartest|wisest|best|right|safest|sensible) (?:thing|move|step|choice|option)\\b|\\bwhat(?:'s| is) my next step\\b|\\btell me what (?:my next step|to do next)\\b",
  "\\b(?:is|would) it (?:be )?(?:ok|okay|fine|safe|better|wise|smart) if i\\b|\\bwould it be (?:better|wiser|smarter) (?:if|to)\\b|\\bam i better off\\b|\\b(?:is|are) (?:staying|leaving|settling|paying|fighting|moving|signing) (?:the )?(?:better|best|smarter|wiser)\\b",
  "\\bgood idea\\s*\\?|\\b(?:any|some|your|need|want|please give me) advice\\b|\\badvice please\\b|\\bdo you (?:recommend|advise|suggest)\\b|\\bcan you (?:recommend|suggest|advise)\\b",
  "\\bwhat would (?:a|the) (?:smart|wise|good|sensible|reasonable) (?:tenant|person) do\\b|\\bwould you (?:settle|go|pay|leave|sign|fight|move|stay|appeal)\\b|\\bdo i stand a chance\\b|\\bdo you think i (?:will|would|am going to) (?:win|lose)\\b|\\bis it worth (?:fighting|it)\\b",
  // a choice between doing something and not doing it ("Do I pay or not?", "leave now or wait?"), and "how do I beat this"
  "\\bdo i (?:pay|go|leave|sign|stay|fight|settle|move|appeal|answer|respond|ignore|skip|hire)\\b[^.?!]{0,30}\\bor (?:not|skip|wait|stay|fight|fold|settle|leave|ignore)\\b",
  "\\b(?:leave|go|stay|pay|settle|fight|sign|move|pay)\\b[^.?!]{0,15}\\bor (?:wait|not|stay|fight|fold|settle|leave|go|pay|skip)\\b",
  "\\b(?:the )?(?:right|smart|wise|best) (?:call|choice|move|decision|idea)\\s*\\?|\\b(?:is it|would it be) a (?:waste|mistake|bad idea)\\b|\\bwhat(?:'s| is) (?:my|the|our) move\\b|\\btell me the (?:smart|wise|right|best) (?:move|thing|choice|call)\\b",
  "\\bhow (?:do|can|could) i (?:beat|win|fight|get out of|defeat|escape)\\b|\\bcan i count on\\b|\\bis there (?:any|a) point (?:in|to)\\b|\\bam i wasting\\b",
  "\\b(?:pick|choose|decide) (?:one )?for me\\b|\\bwhich (?:one )?(?:should i|is (?:better|best) for me)\\b|\\brank my options\\b|\\btell me which (?:to|one)\\b"
];

const ES = [
  "\\bqu[eé] (?:debo|deber[ií]a)\\b(?!\\s+(?:llevar|traer|saber|esperar|vestir|llegar|leer|revisar|prepararme))",
  "(?<!qu[eé] )\\b(?:debo|deber[ií]a|debemos)\\b(?!\\s+(?:saber|esperar|vestir|llegar|leer|revisar|prepararme|llevar (?:mi |el |la |los |las )?(?:contrato|documentos?|papeles|identificaci[oó]n|copias|recibos|aviso|mensajes)))",
  "\\bqu[eé] hago\\b|\\bqu[eé] (?:debo|deber[ií]a) hacer\\b",
  "\\b(?:me conviene|me recomienda|me aconseja|me sugiere|conviene que)\\b|\\bqu[eé] har[ií]a\\b|\\ben mi lugar\\b|\\bsi usted fuera yo\\b",
  "\\b(?:tengo|hay) (?:alg[uú]n|alguna|algunos|algunas|un|una) (?:caso|defensa|posibilidad|oportunidad|chance)\\b",
  "\\b(?:voy a|puedo) (?:ganar|perder)\\b|\\bcu[aá]les son mis (?:posibilidades|probabilidades|oportunidades|chances)\\b",
  "\\b(?:es|ser[ií]a) (?:buena idea|mejor|seguro|prudente|inteligente|sabio|conveniente)\\b|\\bqu[eé] es lo (?:mejor|m[aá]s (?:inteligente|prudente|sabio)|correcto)\\b",
  "\\b(?:debo|necesito|tengo que) (?:contratar|un abogad[oa]|una abogad[oa])\\b|\\bnecesito (?:un|una) abogad[oa]\\b",
  "\\bpuedo (?:simplemente )?(?:ignorar|no pagar|no ir|no presentarme|dejar de pagar|no responder)\\b",
  "\\b(?:escr[ií]b(?:eme|ame|a)|redact(?:e|a)(?:me)?|ay[uú]d(?:eme|ame) a (?:escribir|redactar|llenar|preparar))\\b",
  "\\b(?:finja|act[uú]e|haz de cuenta|pretende|imagina)\\b[^.?!]{0,25}\\b(?:abogad[oa]|juez)\\b|\\bsea mi abogad[oa]\\b",
  "\\b(?:d[aá]me|deme|necesito|quiero) (?:un )?(?:consejo|asesor[ií]a|asesoramiento) legal\\b",
  "\\b(?:debe|deben|deber[ií]a|deber[ií]an)\\s+(?:irse|pagar|firmar|mudarse|ignorar|contratar|aceptar|ir\\b)",
  "\\bd[ií](?:game|me) (?:exactamente )?qu[eé] (?:hacer|escribir|decir|firmar)\\b|\\bqu[eé] (?:tengo que|debo|deber[ií]a) hacer\\b",
  "\\b(?:prediga|predice|pronostique)\\b[^.?!]{0,30}\\bcaso\\b|\\bc[oó]mo saldr[aá] mi caso\\b"
];

const ADVICE_QUESTION = new RegExp([...EN, ...ES].join("|"), "i");

// Text-speak and number-for-letter spellings, so "shld i", "wat shud i do", "is it ok 2 go" and "Sh0uld I" read as what they are.
const SPELLINGS = [[/\b(?:shld|shud|shuld|shoud)\b/gi, "should"], [/\bwat\b/gi, "what"], [/\bhav\b/gi, "have"], [/\bwil\b/gi, "will"], [/\b2\b/g, "to"], [/\bu\b/gi, "you"], [/(?<=[a-z])0|0(?=[a-z])/gi, "o"]];

export function asksForAdvice(question) {
  let s = String(question || "").replace(INVISIBLE, "").replace(/[’‘`´]/g, "'").replace(/\s+/g, " ");
  for (const [from, to] of SPELLINGS) s = s.replace(from, to);
  return ADVICE_QUESTION.test(s);
}
