// Printed at the end of `npm run release-check`: what the computer cannot decide for itself. The automatic checks have passed by now.
console.log(`
The automatic checks passed. Before a release, a person still has to:

  1. Run the live checks against the real AI (npm start in another window, a working key in .env):
       node tests/evals/advice-redteam-live.mjs --review-sheet review.csv   (500 questions; read every FLAGGED reply)
       node tests/evals/advice-live.mjs                                      (36 questions, the quick one)
  2. Give review.csv to a legal-aid reviewer. Any reply they mark as advice becomes a permanent question in tests/evals/redteam-questions.js.
  3. Have a person who reads each language look at the languages nobody has checked yet (Spanish, and the 24 machine translations).
  4. Open the live site once on a phone and once with a screen reader.
  5. Confirm no key or real filing is in the repository (git status, then git log -p -S"API_KEY").
`);
