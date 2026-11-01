// Sends the AI's answer to the page: streamed as server-sent events, or whole as JSON. The AI call stops if the person leaves.
export const abortOnClose = (res) => {
  const ac = new AbortController();
  res.on("close", () => { if (!res.writableFinished) ac.abort(); });
  return ac;
};
export const sse = (res, event, data) => res.write("event: " + event + "\ndata: " + JSON.stringify(data) + "\n\n");

export function createTasks(ai) {
  // Streaming answers (plain-words explanation, chat): server-sent events.
  async function streamTask(res, req) {
    const ac = abortOnClose(res);
    res.status(200).set({ "Content-Type": "text/event-stream", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" });
    res.flushHeaders();
    const r = await ai.stream({ ...req, signal: ac.signal, onText: (t) => sse(res, "text", { t }) });
    res.locals.usage = r.usage;
    sse(res, "done", { truncated: r.truncated });
    res.end();
  }
  async function jsonTask(res, req) {
    const ac = abortOnClose(res);
    const r = await ai.json({ ...req, signal: ac.signal });
    res.locals.usage = r.usage;
    res.json({ data: r.data });
  }
  return { streamTask, jsonTask };
}
