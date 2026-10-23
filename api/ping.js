// POST /api/ping {"version": "0.9.6"}: counts one active copy of Hatch for today.
// Each copy sends this at most once a day. Only the version is stored, as a daily
// count; nothing about the request (IP address, device, etc.) is kept.
const { pipeline, day } = require("./_store");

const KEEP_SECONDS = 90 * 86400;
const VERSION = /^\d{1,3}\.\d{1,3}\.\d{1,3}(\.\d{1,3})?$/;

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const version = req.body && req.body.version;
  if (typeof version !== "string" || !VERSION.test(version)) {
    return res.status(400).json({ error: "Invalid version" });
  }
  const key = `active:${day()}`;
  try {
    await pipeline([["HINCRBY", key, version, 1], ["EXPIRE", key, KEEP_SECONDS]]);
    return res.status(204).end();
  } catch (error) {
    return res.status(503).json({ error: "Unavailable" });
  }
};
