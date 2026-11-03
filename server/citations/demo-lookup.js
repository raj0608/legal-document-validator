// `npm run demo`: a citation lookup that knows three real Supreme Court cases and nothing else, so the demo needs no key.
// The same shape as courtlistener.js. Everything it does not know comes back "not found", like a real lookup with a gap.
const ORIGIN = "https://www.courtlistener.com";
const KNOWN = {
  "405|U.S.|56": { name: "Lindsey v. Normet", year: 1972 },
  "397|U.S.|254": { name: "Goldberg v. Kelly", year: 1970 },
  "424|U.S.|319": { name: "Mathews v. Eldridge", year: 1976 }
};

export function createDemoLookup() {
  return {
    provider: "demo",
    async lookup(cites) {
      return cites.map((c) => {
        const k = KNOWN[[c.volume, c.reporter, c.page].join("|")];
        return k ? { status: "found", clusters: [{ ...k, url: ORIGIN + "/c/" + c.reporter + "/" + c.volume + "/" + c.page + "/" }] } : { status: "not_found", clusters: [] };
      });
    }
  };
}
