// Client tipis untuk Upstash Redis REST API.
// Dipakai untuk simpan API key & hitung usage. Cocok untuk Vercel serverless
// karena tidak butuh koneksi TCP yang persist (beda dengan redis biasa).
//
// Kenapa butuh ini: Vercel serverless function filesystem-nya read-only/ephemeral,
// jadi API key & counter usage TIDAK BISA disimpan di file lokal atau variabel
// in-memory (akan hilang / tidak konsisten antar request). Upstash Redis REST
// gratis untuk skala kecil-menengah dan tinggal HTTP call biasa.

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

function isConfigured() {
  return Boolean(UPSTASH_URL && UPSTASH_TOKEN);
}

async function redisCall(commandArray) {
  if (!isConfigured()) {
    throw new Error(
      "Upstash Redis belum dikonfigurasi. Set UPSTASH_REDIS_REST_URL dan UPSTASH_REDIS_REST_TOKEN di .env"
    );
  }
  const res = await fetch(UPSTASH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(commandArray)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upstash error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.result;
}

const redis = {
  get: (key) => redisCall(["GET", key]),
  set: (key, value) => redisCall(["SET", key, value]),
  del: (key) => redisCall(["DEL", key]),
  hset: (key, obj) => {
    const flat = Object.entries(obj).flat();
    return redisCall(["HSET", key, ...flat]);
  },
  hgetall: async (key) => {
    const raw = await redisCall(["HGETALL", key]);
    if (!raw || raw.length === 0) return null;
    const obj = {};
    for (let i = 0; i < raw.length; i += 2) obj[raw[i]] = raw[i + 1];
    return obj;
  },
  incrWithExpire: async (key, expireSeconds) => {
    const val = await redisCall(["INCR", key]);
    if (val === 1) {
      // baru dibuat, set TTL supaya counter reset otomatis
      await redisCall(["EXPIRE", key, String(expireSeconds)]);
    }
    return val;
  },
  sadd: (key, member) => redisCall(["SADD", key, member]),
  smembers: (key) => redisCall(["SMEMBERS", key])
};

module.exports = { redis, isConfigured };
