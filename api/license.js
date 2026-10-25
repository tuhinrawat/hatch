// GET /api/license?order=<payment_id> — returns the licence key minted for that order, so
// the post-purchase page can show it. Order ids are long, unguessable Dodo payment ids.
const { pipeline } = require("./_store");

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  const order = (req.query && req.query.order) || "";
  if (!/^[A-Za-z0-9_.:-]{8,120}$/.test(order)) return res.status(400).json({ error: "Invalid order" });
  try {
    const [key] = await pipeline([["GET", `license:${order}`]]);
    if (!key) return res.status(404).json({ error: "Not found yet" });
    return res.status(200).json({ license: key });
  } catch (error) {
    return res.status(503).json({ error: String(error.message || error) });
  }
};
