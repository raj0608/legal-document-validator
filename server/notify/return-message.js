// Writes the message for a filing that was returned for correction. Pure: the same input always gives the same message,
// and nothing is sent anywhere. The input has already been checked by checkReturnNotice in server/checks.js.
import { cureDeadline } from "../../shared/dates/cure-deadline.js";
import { smsParts } from "./sms-parts.js";
import { REASONS, TEXT } from "./templates.js";

const LOCALE = { en: "en-US", es: "es-US" };
const fmt = (lang, opts, d) => new Intl.DateTimeFormat(LOCALE[lang], opts).format(d);
const longDate = (lang, d) => fmt(lang, { weekday: "long", month: "long", day: "numeric", year: "numeric" }, d);
const shortDate = (lang, d) => fmt(lang, { weekday: "short", month: "short", day: "numeric" }, d);

// input: { lang: "en" | "es", channel: "email" | "sms", reasons: [ids], other: string, returnedOn: "YYYY-MM-DD" }
export function composeReturnNotice({ lang, channel, reasons, other, returnedOn }) {
  const deadline = cureDeadline(returnedOn);
  const text = TEXT[lang];
  const full = reasons.map((id) => REASONS[lang][id][0]).concat(other ? [other] : []);
  const short = reasons.map((id) => REASONS[lang][id][1]).concat(other ? [other] : []);
  const fixBy = deadline.date;
  if (channel === "sms") {
    const body = text.sms(short.join(", "), shortDate(lang, fixBy));
    return { channel, lang, subject: null, body, fixBy, parts: smsParts(body) };
  }
  const body = [text.tag, "", text.intro, "", text.found, ...full.map((r) => "- " + r), "", text.deadline(longDate(lang, fixBy)), "", text.details, text.help, text.notAdvice].join("\n");
  return { channel, lang, subject: text.subject, body, fixBy, parts: null };
}
