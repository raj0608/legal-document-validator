// A calendar file (.ics) with every date and the reminders the person chose, as built-in alarms.
// One file works on iPhone, Android (Google Calendar), Outlook and desktop calendars, and nothing goes through a server.
// Pure functions, no DOM.
//
// Times are "floating" (no time zone): 9:00 means 9:00 on the phone that opens the file, which is what a person in
// Indiana expects. Alarms are relative to the start of the event, so every calendar app understands them.

const pad = (n) => String(n).padStart(2, "0");
const day = (d) => "" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
const stamp = (d) => day(d) + "T" + pad(d.getHours()) + pad(d.getMinutes()) + "00";
const utcStamp = (d) => d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + "T" + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + "Z";

// Text values: backslash, semicolon, comma and line breaks are escaped (RFC 5545).
export const escapeText = (s) => String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// Lines may not be longer than 75 bytes: longer ones continue on the next line after a space. Never splits a character.
export function fold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = "", bytes = 0, limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > limit) { out.push(cur); cur = ""; bytes = 0; limit = 74; }
    cur += ch; bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

// "-P1DT15H" style duration for an alarm that goes off `minutes` before the start.
export function before(minutes) {
  const m = Math.max(0, Math.round(minutes));
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), r = m % 60;
  const time = (h ? h + "H" : "") + (r ? r + "M" : "");
  if (!d && !time) return "PT0M";
  return "-P" + (d ? d + "D" : "") + (time ? "T" + time : "");
}

// events: [{ uid, summary, description, location, start: Date, allDay: bool, alarms: [{ at: Date, text }] }]
// For an all-day event `start` is that day at 00:00. Alarms that are already in the past are left out.
export function buildIcs(events, { now = new Date(), name = "Court dates" } = {}) {
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Lets Get Ready for Court//Prototype//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:" + escapeText(name)];
  for (const e of events) {
    L.push("BEGIN:VEVENT", "UID:" + e.uid, "DTSTAMP:" + utcStamp(now));
    if (e.allDay) {
      const next = new Date(e.start.getFullYear(), e.start.getMonth(), e.start.getDate() + 1);
      L.push("DTSTART;VALUE=DATE:" + day(e.start), "DTEND;VALUE=DATE:" + day(next));
    } else {
      L.push("DTSTART:" + stamp(e.start), "DTEND:" + stamp(new Date(e.start.getTime() + 36e5)));
    }
    L.push("SUMMARY:" + escapeText(e.summary));
    if (e.description) L.push("DESCRIPTION:" + escapeText(e.description));
    if (e.location) L.push("LOCATION:" + escapeText(e.location));
    for (const a of e.alarms || []) {
      if (a.at <= now) continue;
      L.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + escapeText(a.text || e.summary), "TRIGGER:" + before((e.start - a.at) / 6e4), "END:VALARM");
    }
    L.push("END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return L.map(fold).join("\r\n") + "\r\n";
}
