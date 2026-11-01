// Settings read from the environment (.env): rate limits, the daily cap, proxies and the port.
const num = (v, d) => (v !== undefined && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : d);

export function readConfig(env) {
  return {
    rateLimitPerMin: num(env.RATE_LIMIT_PER_MIN, 20),
    dailyCap: num(env.DAILY_REQUEST_CAP, 2000),
    // Set to the number of proxies in front of the server (1 on most hosts) so rate limits use the real client address.
    trustProxy: env.TRUST_PROXY === undefined ? undefined : (Number.isNaN(Number(env.TRUST_PROXY)) ? env.TRUST_PROXY : Number(env.TRUST_PROXY))
  };
}

export function readPort(env) {
  return num(env.PORT, 3000);
}
