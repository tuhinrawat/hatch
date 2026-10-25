// Shared licence helpers: mint an Ed25519-signed Hatch Pro key, and verify a Dodo webhook
// (Standard Webhooks spec). The private key never leaves the LICENSE_PRIVATE_KEY env var;
// the matching public key is embedded in the app and verifies keys offline, forever.
const crypto = require("crypto");

function b64url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Signs a payload object and returns the licence key string (without the HATCH- prefix). */
function makeLicense(payload) {
  const pem = process.env.LICENSE_PRIVATE_KEY;
  if (!pem) throw new Error("LICENSE_PRIVATE_KEY is not set");
  const key = crypto.createPrivateKey(pem);
  const bytes = Buffer.from(JSON.stringify(payload));
  const sig = crypto.sign(null, bytes, key); // Ed25519
  return `${b64url(bytes)}.${b64url(sig)}`;
}

/** Reads the raw request body (needed because the signature covers the exact bytes). */
async function rawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Verifies a Standard Webhooks signature (the scheme Dodo Payments uses): an HMAC-SHA256 of
 * `id.timestamp.body`, base64-encoded, keyed by the secret's bytes. Returns true/false and
 * never throws on a bad signature.
 */
function verifyWebhook({ id, timestamp, body, signatureHeader, secret }) {
  if (!id || !timestamp || !body || !signatureHeader || !secret) return false;
  // Reject deliveries more than five minutes old (replay protection).
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  // Secrets look like "whsec_<base64>"; the key is the decoded part after the prefix.
  const raw = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const keyBytes = Buffer.from(raw, "base64");
  const signed = `${id}.${timestamp}.${body}`;
  const expected = crypto.createHmac("sha256", keyBytes).update(signed).digest("base64");
  // The header is a space-separated list of "v1,<sig>" entries; any match is enough.
  for (const part of signatureHeader.split(" ")) {
    const sig = part.includes(",") ? part.split(",")[1] : part;
    if (sig && timingSafeEqual(sig, expected)) return true;
  }
  return false;
}

function timingSafeEqual(a, b) {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

module.exports = { makeLicense, rawBody, verifyWebhook };
