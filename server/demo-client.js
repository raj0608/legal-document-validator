// A stand-in for the Anthropic client, for `npm run demo`. It lets the team try the whole product, and show it
// to people, without an API key or any cost. Nothing here calls a model: the "answers" are templates filled in
// from the paper itself (its dates, its blank lines, the problems a clerk lists), and every one starts with [Demo].
// The page shows a bar saying so. Translation is not faked: it reports a failure, like a real outage would.
import { findDates } from "../shared/analysis/paper-dates.js";

const long = (d) => new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(d);

// The paper as the page sent it: between the delimiter lines of the first user message.
function paperOf(params) {
  const m = /DOC-[0-9a-f]+ BEGIN\n([\s\S]*?)\nDOC-[0-9a-f]+ END/.exec(params.messages[0].content);
  return m ? m[1] : "";
}

function explain(paper) {
  const dates = findDates(paper);
  const lines = ["**[Demo] What this paper is**", "This is an example answer. In the real version, the helper explains your paper here in plain words."];
  if (dates.length) {
    lines.push("**Dates in it**");
    dates.slice(0, 4).forEach((d) => lines.push("- ==" + long(d.date) + "==" + (d.time ? " (the paper gives a time)" : "")));
  }
  lines.push("**What it asks you to bring**", "- The paper says what to bring. The real helper would quote those words.");
  return lines.join("\n");
}

function chat(paper, question) {
  const dates = findDates(paper);
  const first = dates.find((d) => d.hearingLike) || dates[0];
  return "[Demo] This is an example reply to “" + question.slice(0, 80) + "”. The real helper would answer from your paper and the Indiana sources." +
    (first ? " Your paper has the date ==" + long(first.date) + "==." : "");
}

function blanks(paper) {
  const items = paper.split("\n").filter((l) => /_{4,}|\[\s\]/.test(l)).slice(0, 5).map((l) => {
    const label = l.replace(/_{2,}|\[\s\]/g, "").replace(/\s+/g, " ").replace(/[:.\s]+$/, "").trim() || "Blank line";
    return { label: label.slice(0, 60), asks: "[Demo] The real helper would say, in one plain sentence, what this line asks for." };
  });
  return { items };
}

function clerk(paper) {
  const problems = paper.split("\n").map((l) => /^\s*\d+[.)]\s+(.*)$/.exec(l)).filter(Boolean).map((m) => m[1].trim());
  return {
    summary: "[Demo] This is an example summary. The real helper would explain, in two or three plain sentences, what the clerk’s notice says.",
    items: problems.slice(0, 6).map((q) => ({ quote: q, plain: "[Demo] The real helper would explain what this means, without saying what to do." }))
  };
}

export function demoClient() {
  return {
    messages: {
      stream(params, opts = {}) {
        const handlers = [];
        return {
          on(ev, fn) { if (ev === "text") handlers.push(fn); return this; },
          async finalMessage() {
            const first = params.messages[0].content;
            if (/^Translate the values/.test(first)) throw new Error("translation is not available in the demo");
            const paper = paperOf(params);
            let reply;
            if (/List each line, box, or blank/.test(first)) reply = JSON.stringify(blanks(paper));
            else if (/notice from a court clerk/.test(first)) reply = JSON.stringify(clerk(paper));
            else if (/TASK: Explain the document/.test(first)) reply = explain(paper);
            else reply = chat(paper, params.messages.at(-1).content.replace(/^[\s\S]*Question from the person: /, ""));
            for (const piece of reply.split(/(?<= )/)) {
              if (opts.signal && opts.signal.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });
              await new Promise((r) => setTimeout(r, 12));
              handlers.forEach((h) => h(piece));
            }
            return { stop_reason: "end_turn", usage: { input_tokens: 0, output_tokens: 0 } };
          }
        };
      }
    }
  };
}
