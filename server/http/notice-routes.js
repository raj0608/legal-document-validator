// The route for a filing returned for correction. It writes the message and shows it: nothing is sent, stored or logged.
// Who the message is for (an email address or a phone number) is used once, to show the preview, and then forgotten.
import { checkReturnNotice } from "../checks.js";
import { composeReturnNotice } from "../notify/return-message.js";
import { toISO } from "../../shared/dates/date-math.js";
import { wrap } from "./error-responses.js";

export function addNoticeRoutes(api, { now }) {
  api.post("/return-notice/preview", wrap(async (req, res) => {
    const input = checkReturnNotice(req.body, now());
    const m = composeReturnNotice(input);
    res.json({ data: { sent: false, channel: m.channel, lang: m.lang, to: input.to, subject: m.subject, body: m.body, fixBy: toISO(m.fixBy), parts: m.parts } });
  }));
}
