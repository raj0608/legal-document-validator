// Talks to this site's own server. The AI key is never in the browser.
// Errors carry the same `code` values the page has always handled, plus `text` when part of an answer arrived.
const fail = (code, text) => Object.assign(new Error(code), { code, text: text || "" });

async function request(path, body, signal) {
  let res;
  try {
    res = await fetch("/api/" + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  } catch (e) {
    throw fail(e && e.name === "AbortError" ? "cancelled" : "unavailable");
  }
  if (!res.ok) {
    let code = "generic";
    try { code = (await res.json()).error.code || code; } catch (e) { /* not JSON */ }
    throw fail(code);
  }
  return res;
}

// Is the AI helper turned on at the server, and is it the demo (sample answers)?
export async function health() {
  try { const h = await (await fetch("/api/health")).json(); return { ai: Boolean(h.ai), demo: Boolean(h.demo) }; } catch (e) { return { ai: false, demo: false }; }
}

// Streamed answer. onText({text}) gets the whole answer so far, like the page always expected.
export async function stream(path, body, { signal, onText } = {}) {
  const res = await request(path, body, signal);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", text = "", truncated = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let cut;
      while ((cut = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, cut);
        buffer = buffer.slice(cut + 2);
        const m = /^event: (\w+)\ndata: (.*)$/s.exec(block);
        if (!m) continue;
        const data = JSON.parse(m[2]);
        if (m[1] === "text") { text += data.t; if (onText) onText({ text }); }
        else if (m[1] === "done") truncated = Boolean(data.truncated);
        else if (m[1] === "error") throw fail(data.code, data.text || text);
      }
    }
  } catch (e) {
    if (e && e.code) throw e;
    throw fail(e && e.name === "AbortError" ? "cancelled" : "generic", text);
  }
  return { text, truncated };
}

// An answer that comes back as JSON (blanks, clerk notice).
export async function json(path, body, { signal } = {}) {
  const res = await request(path, body, signal);
  return (await res.json()).data;
}

// Which of these citations ({ volume, reporter, page }) a public case-law database knows: [{ status, clusters }], in the same order.
export async function lookupCitations(cites, { signal } = {}) {
  return (await json("cites", { cites }, { signal })).results;
}

// Machine translation of the page's own text: { ui, faq }.
export async function translate(lang) {
  return (await request("translate", { lang })).json();
}
