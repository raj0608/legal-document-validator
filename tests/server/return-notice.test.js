// The route for a filing returned for correction: what it accepts, what it refuses, and what it never does.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../../server/http/app.js";
import { checkReturnNotice } from "../../server/checks.js";
import { parseEmail, parsePhone } from "../../server/notify/contact.js";
import { composeReturnNotice } from "../../server/notify/return-message.js";
import { smsParts } from "../../server/notify/sms-parts.js";
import { open, shutdown } from "./fake-anthropic.js";

after(() => Promise.all([...open].map(shutdown)));

const NOW = new Date(2026, 10, 9); // Monday, November 9, 2026
const GOOD = { lang: "en", channel: "email", reasons: ["not_signed", "no_phone"], other: "", returnedOn: "2026-11-09", to: "kimi.sample@example.com" };

async function serve(config = {}) {
  const app = createApp({ config: { log: false, now: () => NOW, ...config } });
  const server = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  open.add(server);
  const base = "http://127.0.0.1:" + server.address().port;
  return { post: (body) => fetch(base + "/api/return-notice/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), close: () => shutdown(server) };
}
const code = async (r) => (await r.json()).error.code;

test("an email preview has the subject, the reasons and the last day, and says nothing was sent", async () => {
  const s = await serve();
  const r = await s.post(GOOD);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("cache-control"), "no-store");
  const { data } = await r.json();
  assert.deepEqual(Object.keys(data).sort(), ["body", "channel", "fixBy", "lang", "parts", "sent", "subject", "to"]);
  assert.equal(data.sent, false);
  assert.equal(data.to, "kimi.sample@example.com");
  assert.equal(data.fixBy, "2026-11-13");
  assert.match(data.subject, /^\[Test\] /);
  assert.match(data.body, /The document is not signed\./);
  assert.match(data.body, /A telephone number is missing\./);
  assert.match(data.body, /Friday, November 13, 2026/);
  assert.match(data.body, /not from a court/);
  assert.equal(data.parts, null);
  await s.close();
});

test("a text preview has no subject, a standard phone number, and how many parts it takes", async () => {
  const s = await serve();
  const { data } = await (await s.post({ ...GOOD, channel: "sms", to: "(260) 555-0147", reasons: ["not_signed"] })).json();
  assert.equal(data.to, "+12605550147");
  assert.equal(data.subject, null);
  assert.equal(data.parts, 1);
  assert.match(data.body, /^\[Test\] /);
  assert.match(data.body, /Fri, Nov 13/);
  await s.close();
});

test("the message can be in Spanish, and no other language", async () => {
  const s = await serve();
  const es = (await (await s.post({ ...GOOD, lang: "es" })).json()).data;
  assert.match(es.subject, /^\[Prueba\]/);
  assert.match(es.body, /viernes, 13 de noviembre de 2026/);
  assert.match(es.body, /Regla de Procedimiento 88/);
  assert.equal((await s.post({ ...GOOD, lang: "fr" })).status, 400);
  await s.close();
});

test("a reason in the clerk's own words is added, and the last day follows the court's holidays", async () => {
  const s = await serve({ now: () => new Date(2026, 10, 24) });
  const { data } = await (await s.post({ ...GOOD, reasons: [], other: "Page 2 is missing", returnedOn: "2026-11-24" })).json();
  assert.match(data.body, /- Page 2 is missing\n/);
  assert.equal(data.fixBy, "2026-11-30"); // Thanksgiving, Thursday Nov 26, is skipped
  await s.close();
});

test("each kind of bad input gets its own code and a 400", async () => {
  const s = await serve();
  const bad = async (patch) => { const r = await s.post({ ...GOOD, ...patch }); return [r.status, await code(r)]; };
  assert.deepEqual(await bad({ to: "not an email" }), [400, "invalid_contact"]);
  assert.deepEqual(await bad({ channel: "sms", to: "123" }), [400, "invalid_contact"]);
  assert.deepEqual(await bad({ other: "see https://evil.example" }), [400, "invalid_text"]);
  assert.deepEqual(await bad({ reasons: [], other: "" }), [400, "invalid_reason"]);
  assert.deepEqual(await bad({ reasons: ["made_up"] }), [400, "invalid_reason"]);
  assert.deepEqual(await bad({ reasons: ["not_signed", "not_signed"] }), [400, "invalid_reason"]);
  assert.deepEqual(await bad({ returnedOn: "2026-02-30" }), [400, "invalid_date"]);
  assert.deepEqual(await bad({ returnedOn: "2026-12-25" }), [400, "invalid_date"]); // in the future
  assert.deepEqual(await bad({ returnedOn: "2026-01-01" }), [400, "invalid_date"]); // long ago
  assert.deepEqual(await bad({ channel: "fax" }), [400, "bad_request"]);
  for (const body of [null, [], "text"]) assert.equal((await s.post(body)).status, 400);
  await s.close();
});

test("a filing returned today or yesterday, or on a day the clerk is catching up, is accepted", () => {
  for (const returnedOn of ["2026-11-09", "2026-11-08", "2026-10-12", "2026-11-10"]) assert.equal(checkReturnNotice({ ...GOOD, returnedOn }, NOW).returnedOn, returnedOn);
});

test("extra fields in the request are dropped, and cannot reach the message", () => {
  const out = checkReturnNotice({ ...GOOD, bcc: "x@y.com", subject: "Free money", body: "hello", from: "court@in.gov" }, NOW);
  assert.deepEqual(Object.keys(out).sort(), ["channel", "lang", "other", "reasons", "returnedOn", "to"]);
  const m = composeReturnNotice(out);
  assert.doesNotMatch(m.subject + m.body, /Free money|hello|court@in\.gov|x@y\.com/);
});

test("the route works without any AI or citation lookup set up", async () => {
  const s = await serve();
  assert.equal((await s.post(GOOD)).status, 200);
  await s.close();
});

test("email addresses: one plain address, a standard form out", () => {
  assert.equal(parseEmail("  Kimi.Sample@Example.COM "), "Kimi.Sample@example.com");
  assert.equal(parseEmail("kimi+court@mail.example.org"), "kimi+court@mail.example.org");
  for (const bad of ["a@b", "a b@c.com", "a@b.com, c@d.com", "<a@b.com>", "", 5, null]) assert.throws(() => parseEmail(bad), (e) => e.code === "invalid_contact", String(bad));
});

test("phone numbers: a US number in any common style becomes +1 and ten digits", () => {
  for (const ok of ["(260) 555-0147", "260-555-0147", "260.555.0147", "+1 260 555 0147", "1-260-555-0147", "2605550147"]) assert.equal(parsePhone(ok), "+12605550147", ok);
  for (const bad of ["911", "800-555-0147", "900-555-0147", "123-456-7890", "+44 20 7946 0958", "260-555-014", "260\n555\n0147"]) assert.throws(() => parsePhone(bad), (e) => e.code === "invalid_contact", bad);
});

test("text parts: 160 plain letters fit one part, a curly apostrophe or an accent drops it to 70", () => {
  assert.equal(smsParts("a".repeat(160)), 1);
  assert.equal(smsParts("a".repeat(161)), 2);
  assert.equal(smsParts("a".repeat(70) + "’"), 2);
  assert.equal(smsParts("á".repeat(70)), 1);
  assert.equal(smsParts("á".repeat(71)), 2);
  assert.equal(smsParts("€".repeat(80)), 1);
  assert.equal(smsParts("€".repeat(81)), 2);
});
