// A Google Calendar link that opens with one event already filled in.
import { ymd, hm, addDays } from "/shared/dates/date-math.js";

export function gcal(title, start, end, allDay, details, place) {
  const dates = allDay ? ymd(start) + "/" + ymd(addDays(start, 1)) : ymd(start) + "T" + hm(start) + "/" + ymd(end) + "T" + hm(end);
  let url = "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(title) + "&dates=" + dates + "&details=" + encodeURIComponent(details);
  if (place) url += "&location=" + encodeURIComponent(place);
  if (!allDay) url += "&ctz=America/Indiana/Indianapolis";
  return url;
}
