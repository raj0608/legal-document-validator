// The citation lookup route, for the court staff page. Only citation numbers arrive here, never the text of a filing.
import { ApiError } from "../errors.js";
import { checkCites } from "../checks.js";
import { createLookupCache } from "../citations/lookup-cache.js";
import { abortOnClose } from "./streaming.js";
import { wrap } from "./error-responses.js";

export function addCitationRoutes(api, { citations, spend }) {
  const cache = createLookupCache();
  const key = (c) => [c.volume, c.reporter, c.page].join("|");

  api.post("/cites", wrap(async (req, res) => {
    const cites = checkCites(req.body.cites);
    if (!citations) throw new ApiError("unavailable", 503);
    spend();
    const results = cites.map((c) => cache.get(key(c)));
    const todo = cites.map((c, i) => i).filter((i) => !results[i]);
    if (todo.length) {
      const ac = abortOnClose(res);
      const fresh = await citations.lookup(todo.map((i) => cites[i]), ac.signal);
      todo.forEach((i, n) => {
        results[i] = fresh[n];
        if (fresh[n].status !== "limited") cache.set(key(cites[i]), fresh[n]); // a limited answer is not an answer: ask again later
      });
    }
    res.json({ data: { results } });
  }));
}
