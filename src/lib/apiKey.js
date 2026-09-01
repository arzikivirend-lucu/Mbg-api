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

module.exports = { generateKey, createApiKey, getApiKeyRecord, revokeApiKey, KEY_PREFIX };
