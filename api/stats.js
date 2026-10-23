// GET /api/stats with "Authorization: Bearer <ADMIN_TOKEN>": daily active copies by
// version for the last 30 days. Only for the admin dashboard; the token is a Vercel
// environment variable that only the site owner knows.
const crypto = require("crypto");
const { pipeline, day } = require("./_store");

const DAYS = 30;

function authorized(req) {
  const expected = process.env.ADMIN_TOKEN || "";
  const given = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (expected.length < 16 || given.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/** DMG downloads per release, as counted by GitHub. */
async function downloads() {
  try {
    const response = await fetch("https://api.github.com/repos/tuhinrawat/hatch/releases?per_page=50",
      { headers: { "User-Agent": "hatch-stats" } });
    const releases = await response.json();
    return releases.map((r) => ({
      version: r.tag_name.replace(/^v/, ""),
      count: (r.assets || []).reduce((sum, a) => sum + a.download_count, 0),
    }));
  } catch {
    return [];
  }
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!authorized(req)) return res.status(401).json({ error: "Unauthorized" });
  const days = Array.from({ length: DAYS }, (_, i) => day(i));
  try {
    const results = await pipeline(days.map((d) => ["HGETALL", `active:${d}`]));
    const daily = days.map((d, i) => {
      const flat = results[i] || [];
      const versions = {};
      for (let j = 0; j < flat.length; j += 2) versions[flat[j]] = Number(flat[j + 1]);
      const total = Object.values(versions).reduce((a, b) => a + b, 0);
      return { day: d, total, versions };
    });
    return res.status(200).json({ daily, downloads: await downloads() });
  } catch (error) {
    return res.status(503).json({ error: String(error.message || error) });
  }
};
