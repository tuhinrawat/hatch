// Shared helpers for the install counter, backed by Upstash Redis over its REST API.
// Vercel's Upstash integration provides the URL and token as environment variables.

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

/** Runs several Redis commands in one request and returns their results. */
async function pipeline(commands) {
  if (!url || !token) throw new Error("Storage is not connected");
  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  if (!response.ok) throw new Error(`Storage error ${response.status}`);
  return (await response.json()).map((r) => r.result);
}

/** The UTC day as YYYY-MM-DD, `daysAgo` days back. */
function day(daysAgo = 0) {
  return new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
}

module.exports = { pipeline, day };
