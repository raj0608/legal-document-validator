// The warnings under an AI answer: a date that is not in the paper, and words that sound like advice.
import { el } from "/web/shared/lib/dom.js";
import { t } from "/web/shared/lib/page-text.js";
import { looksLikeAdvice } from "/shared/safety/advice.js";
import { unsupportedDates, allowedDates } from "/shared/answer-dates.js";

// A date in an answer that is not in the paper was worked out by the AI, which it is told never to do. Say so.
export function addDateFlag(container, text, paperText) {
  const extra = unsupportedDates(text, allowedDates(paperText));
  if (extra.length) container.appendChild(el("p", "warn flag", t("date_flag", { x: extra.join(", ") })));
}

// Replies are shown as they are. A reply with should/must-style words gets a warning under it.
export function addAdviceFlag(container, text) {
  if (looksLikeAdvice(text)) container.appendChild(el("p", "warn flag", t("advice_flag")));
}
