// Request log: method, path, status, time, token counts. Never bodies.
export function requestLog(cfg) {
  return (req, res, next) => {
    if (!cfg.log) return next();
    const t0 = Date.now();
    res.on("finish", () => {
      const u = res.locals.usage;
      console.log(`${req.method} ${req.originalUrl.split("?")[0]} ${res.statusCode} ${Date.now() - t0}ms` + (u ? ` in=${u.input_tokens} out=${u.output_tokens}` : ""));
    });
    next();
  };
}
