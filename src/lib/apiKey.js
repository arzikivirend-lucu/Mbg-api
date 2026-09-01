const { nanoid } = require("nanoid");
const { redis } = require("./redis");

const KEY_PREFIX = "mbg_live_";

function generateKey() {
  return `${KEY_PREFIX}${nanoid(32)}`;
}

// Simpan key baru. plan menentukan limit harian (lihat rateLimit.js).
// email bersifat opsional — dipakai oleh signup publik (src/routes/signup.js)
// untuk menegakkan aturan "satu email, satu key".
async function createApiKey({ ownerName, plan = "free", email }) {
  const key = generateKey();
  await redis.hset(`apikey:${key}`, {
    owner: ownerName || "unknown",
    email: email || "",
    plan,
    active: "true",
    createdAt: new Date().toISOString()
  });
  await redis.sadd("apikey:index", key);
  if (email) {
    await redis.set(`apikey:email:${email.toLowerCase()}`, key);
  }
  return key;
}

// Cek apakah email tertentu sudah pernah generate key (dipakai signup publik).
async function findKeyByEmail(email) {
  if (!email) return null;
  return redis.get(`apikey:email:${email.toLowerCase()}`);
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

module.exports = { generateKey, createApiKey, getApiKeyRecord, revokeApiKey, findKeyByEmail, KEY_PREFIX };
