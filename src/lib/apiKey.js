const { nanoid } = require("nanoid");
const { redis } = require("./redis");

const KEY_PREFIX = "mbg_live_";

function generateKey() {
  return `${KEY_PREFIX}${nanoid(32)}`;
}

// Simpan key baru. plan menentukan limit harian (lihat rateLimit.js)
async function createApiKey({ ownerName, plan = "free" }) {
  const key = generateKey();
  await redis.hset(`apikey:${key}`, {
    owner: ownerName || "unknown",
    plan,
    active: "true",
    createdAt: new Date().toISOString()
  });
  await redis.sadd("apikey:index", key);
  return key;
}

async function getApiKeyRecord(key) {
  if (!key || !key.startsWith(KEY_PREFIX)) return null;
  const record = await redis.hgetall(`apikey:${key}`);
  if (!record) return null;
  return record;
}

async function revokeApiKey(key) {
  await redis.hset(`apikey:${key}`, { active: "false" });
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

// Cari key yang sudah pernah dibuat untuk email ini (supaya 1 email = 1 key,
// tidak generate berkali-kali kalau orang klik submit berulang).
async function getKeyByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const key = await redis.get(`apikey:by-email:${normalized}`);
  return key || null;
}

// Dipakai oleh endpoint signup publik (/v1/signup) — beda dari createApiKey
// biasa (dipakai endpoint admin) karena: plan dikunci "free" & tercatat
// asal-usulnya "self_signup", plus disimpan mapping email -> key.
async function createSelfSignupKey({ ownerName, email }) {
  const normalized = normalizeEmail(email);
  const key = generateKey();
  await redis.hset(`apikey:${key}`, {
    owner: ownerName || normalized || "unknown",
    email: normalized,
    plan: "free",
    source: "self_signup",
    active: "true",
    createdAt: new Date().toISOString()
  });
  await redis.sadd("apikey:index", key);
  if (normalized) {
    await redis.set(`apikey:by-email:${normalized}`, key);
  }
  return key;
}

module.exports = {
  generateKey,
  createApiKey,
  getApiKeyRecord,
  revokeApiKey,
  getKeyByEmail,
  createSelfSignupKey,
  KEY_PREFIX
};
