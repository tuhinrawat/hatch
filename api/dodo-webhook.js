// POST /api/dodo-webhook — Dodo Payments calls this when a payment succeeds. We verify the
// signature, mint a Hatch Pro licence, and store it so the success page (and later, email)
// can hand it to the buyer. Dodo follows the Standard Webhooks spec.
//
// Required env vars (set in Vercel):
//   DODO_PAYMENTS_WEBHOOK_KEY  — the endpoint's signing secret from the Dodo dashboard
//   LICENSE_PRIVATE_KEY        — the Ed25519 PKCS8 PEM from scripts/setup_license_key.sh
const { pipeline } = require("./_store");
const { makeLicense, rawBody, verifyWebhook } = require("./_license");

// Keep issued licences retrievable for support and re-downloads.
const KEEP_SECONDS = 2 * 365 * 86400;

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const body = await rawBody(req);
  const ok = verifyWebhook({
    id: req.headers["webhook-id"],
    timestamp: req.headers["webhook-timestamp"],
    body,
    signatureHeader: req.headers["webhook-signature"],
    secret: process.env.DODO_PAYMENTS_WEBHOOK_KEY,
  });
  if (!ok) return res.status(401).json({ error: "Bad signature" });

  let event;
  try { event = JSON.parse(body); } catch { return res.status(400).json({ error: "Bad JSON" }); }

  // Only a completed one-time payment unlocks Pro.
  if (event.type !== "payment.succeeded") return res.status(200).json({ ignored: event.type });

  const data = event.data || {};
  const email = data.customer?.email || data.email;
  const order = data.payment_id || data.id || req.headers["webhook-id"];
  if (!email || !order) return res.status(400).json({ error: "Missing email or order id" });

  const key = "HATCH-" + makeLicense({
    v: 1,
    email,
    order: String(order),
    product: "hatch-pro",
    issued: new Date().toISOString().slice(0, 10),
  });

  try {
    // webhook-id is the idempotency key: a redelivery just overwrites the same licence.
    await pipeline([["SET", `license:${order}`, key, "EX", KEEP_SECONDS]]);
  } catch (error) {
    return res.status(503).json({ error: String(error.message || error) });
  }
  return res.status(200).json({ ok: true });
};

// Dodo must see the exact bytes it signed, so don't let the platform pre-parse the body.
module.exports.config = { api: { bodyParser: false } };
