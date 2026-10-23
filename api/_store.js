// Shared helpers for the install counter, backed by Upstash Redis over its REST API.
// Vercel's Upstash integration adds the URL and token as environment variables, sometimes
// with a custom prefix (e.g. STORAGE_KV_REST_API_URL), so match them by suffix.

function findEnv(suffixes, exclude) {
  const names = Object.keys(process.env).filter(
    (name) => suffixes.some((s) => name.endsWith(s)) && !(exclude && name.includes(exclude))
  );
  return names.length ? process.env[names[0]] : undefined;
}

const url = findEnv(["KV_REST_API_URL", "REDIS_REST_URL"]);
const token = findEnv(["KV_REST_API_TOKEN", "REDIS_REST_TOKEN"], "READ_ONLY");

/** Runs several Redis commands in one request and returns their results. */
async function pipeline(commands) {
  if (!url || !token) throw new Error("Storage is not connected (no Upstash REST URL/token found)");
  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  if (!response.ok) throw new Error(`Storage rejected the request (HTTP ${response.status})`);
  return (await response.json()).map((r) => r.result);
}

/** The UTC day as YYYY-MM-DD, `daysAgo` days back. */
function day(daysAgo = 0) {
  return new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
}

module.exports = { pipeline, day };
