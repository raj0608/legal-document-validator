import test from "node:test";
import assert from "node:assert/strict";
import { buildIcs, before, fold, escapeText } from "../../shared/dates/ics.js";
import { computeDates } from "../../shared/dates/case-dates.js";
import { remindersFor, eventStart } from "../../shared/dates/reminders.js";
import { addDays } from "../../shared/dates/date-math.js";

const now = new Date(2026, 10, 1, 12, 0); // Nov 1, 2026, noon
const unfold = (s) => s.replace(/\r\n /g, "");
const lines = (s) => unfold(s).split("\r\n");

const hearing = { uid: "h@x", summary: "Court hearing, Room 000", description: "Line one\nLine two; with, punctuation \\ done", location: "Allen County Courthouse, Room 000",
  start: new Date(2026, 10, 24, 9, 0), allDay: false,
  alarms: [{ at: new Date(2026, 10, 23, 9, 0), text: "Tomorrow" }, { at: new Date(2026, 10, 24, 7, 0), text: "In 2 hours" }, { at: new Date(2026, 9, 1, 9, 0), text: "past" }] };
const deadline = { uid: "d@x", summary: "Last day to fix a returned filing", start: new Date(2026, 10, 16), allDay: true, alarms: [{ at: new Date(2026, 10, 15, 9, 0), text: "Day before" }] };

test("a calendar file has the required frame, CRLF line ends and one event per date", () => {
  const ics = buildIcs([hearing, deadline], { now });
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.ok(!/[^\r]\n/.test(ics), "every line ends in CRLF");
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.equal((ics.match(/END:VEVENT/g) || []).length, 2);
  assert.match(ics, /PRODID:/);
  assert.match(ics, /DTSTAMP:20261101T\d{6}Z/);
});

test("timed events use floating times; deadlines are all-day events ending the next day", () => {
  const L = lines(buildIcs([hearing, deadline], { now }));
  assert.ok(L.includes("DTSTART:20261124T090000"));
  assert.ok(L.includes("DTEND:20261124T100000"));
  assert.ok(L.includes("DTSTART;VALUE=DATE:20261116"));
  assert.ok(L.includes("DTEND;VALUE=DATE:20261117"));
});

test("alarms are relative to the start, and alarms already in the past are left out", () => {
  const L = lines(buildIcs([hearing, deadline], { now }));
  const triggers = L.filter((l) => l.startsWith("TRIGGER:"));
  assert.deepEqual(triggers, ["TRIGGER:-P1D", "TRIGGER:-PT2H", "TRIGGER:-PT15H"]); // hearing: 1 day, 2 hours; deadline: 9:00 the day before = 15 hours before midnight
  assert.equal(L.filter((l) => l === "BEGIN:VALARM").length, 3);
  assert.ok(!L.some((l) => l.includes("DESCRIPTION:past")));
  assert.ok(L.includes("ACTION:DISPLAY"));
});

test("text is escaped, long lines are folded at 75 bytes without splitting a character", () => {
  const ics = buildIcs([hearing], { now });
  const L = lines(ics);
  assert.ok(L.includes("SUMMARY:Court hearing\\, Room 000"));
  assert.ok(L.includes("DESCRIPTION:Line one\\nLine two\\; with\\, punctuation \\\\ done"));
  const long = buildIcs([{ ...hearing, uid: "l@x", description: "Información ".repeat(40) }], { now });
  for (const raw of long.split("\r\n")) assert.ok(new TextEncoder().encode(raw).length <= 75, raw);
  assert.ok(lines(long).some((l) => l.startsWith("DESCRIPTION:" + "Información ".repeat(40).replace(/,/g, "\\,"))));
  assert.equal(fold("short"), "short");
  assert.equal(escapeText("a,b;c\\d\ne"), "a\\,b\\;c\\\\d\\ne");
});

test("durations", () => {
  assert.equal(before(60), "-PT1H");
  assert.equal(before(120), "-PT2H");
  assert.equal(before(1440), "-P1D");
  assert.equal(before(3 * 1440), "-P3D");
  assert.equal(before(7 * 1440), "-P7D");
  assert.equal(before(900), "-PT15H");
  assert.equal(before(1440 + 90), "-P1DT1H30M");
  assert.equal(before(0), "PT0M");
});

test("the dates a person has become events with the reminders they picked", () => {
  const items = computeDates({ hearing: "2026-11-24", time: "09:00", place: "Room 000", served: "2026-11-02", days: 15 });
  const rems = { "1w": false, "3d": false, "1d": true, "2h": true, "1h": false };
  const events = items.filter((it) => it.date >= now).map((it) => {
    const start = it.time ? eventStart(it) : new Date(it.date.getFullYear(), it.date.getMonth(), it.date.getDate());
    return { uid: it.kind + "@x", summary: it.kind, start, allDay: !it.time, alarms: remindersFor(it, rems, now).map((r) => ({ at: r.at, text: r.key })) };
  });
  const ics = buildIcs(events, { now });
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, items.length);
  const hearingBlock = /BEGIN:VEVENT\r\nUID:hearing@x[\s\S]*?END:VEVENT/.exec(ics)[0];
  assert.deepEqual(hearingBlock.match(/TRIGGER:[^\r]+/g), ["TRIGGER:-P1D", "TRIGGER:-PT2H"]); // 1 day before at 9:00, and 2 hours before
  assert.equal(addDays(items.at(-1).date, 0).getTime(), items.at(-1).date.getTime());
});
