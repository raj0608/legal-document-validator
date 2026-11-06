// The reasons a clerk can give when a filing is returned for correction, and the limit on a reason in the clerk's own words.
// The page shows these as checkboxes, and the server accepts nothing else. What each one says to the filer is in server/notify/templates.js.
export const REASON_IDS = ["not_signed", "no_phone", "no_cause", "no_caption", "unreadable", "wrong_form"];
export const OTHER_MAX = 140;
