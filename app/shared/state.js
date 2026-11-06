// Shared page state. State lives in memory only: nothing is written to storage.

export const state = {
  lang: "en",
  papers: null, form: null, clerk: null,
  filing: null, filingReport: null, // court staff page: the filing, and its citation report
  cites: null, citesReport: null, // Check my form, "Cases I name": the tenant's filing, and its case lookup
  returnPreview: null, // court staff page: the message shown for a returned filing, never kept past this visit
  turns: [],
  chatTokens: null, // token state for chat questions when no paper is loaded
  dates: { notice: "", days: 15, served: "", hearing: "", time: "", place: "", cure: "", fromPaper: false },
  rems: { "1w": false, "3d": false, "1d": true, "2h": true, "1h": false },
  lastCure: null
};
export const TR = {}; // machine translations, kept for this visit only
