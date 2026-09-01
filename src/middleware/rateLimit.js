const { redis } = require("../lib/redis");

// Limit request per hari, per plan. Sesuaikan bebas.
const PLAN_LIMITS = {
  free: 100,
  pro: 5000,
  internal: Infinity
};

const ONE_DAY_SECONDS = 24 * 60 * 60;

async function rateLimit(req, res, next) {
  // Request internal (dari website sendiri) tidak dibatasi.
  if (req.auth?.type === "internal") return next();

  const { key, record } = req.auth;
  const plan = record.plan || "free";
  const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const counterKey = `usage:${key}:${today}`;

  let count;
  try {
    count = await redis.incrWithExpire(counterKey, ONE_DAY_SECONDS);
  } catch (e) {
    // Kalau Redis lagi down, jangan block total — log dan lanjut.
    console.error("Rate limit check gagal:", e.message);
    return next();
  }

  res.setHeader("X-RateLimit-Limit", limit);
  res.setHeader("X-RateLimit-Remaining", Math.max(0, limit - count));

  if (count > limit) {
    return res.status(429).json({
      error: {
        message: `Kuota harian (${limit} request/hari untuk plan '${plan}') sudah habis. Coba lagi besok atau upgrade plan.`,
        type: "rate_limit_error"
      }
    });
  }

  next();
}

module.exports = { rateLimit, PLAN_LIMITS };

// Limiter terpisah & lebih ketat untuk POST /v1/signup (publik, tanpa API key)
// supaya endpoint ini tidak bisa dipakai buat generate key massal / spam.
// Dikunci per-IP, bukan per-key, karena di titik ini user belum punya key.
const SIGNUP_LIMIT_PER_IP_PER_DAY = 5;

async function signupRateLimit(req, res, next) {
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim();
  const today = new Date().toISOString().slice(0, 10);
  const counterKey = `usage:signup:${ip}:${today}`;

  try {
    const count = await redis.incrWithExpire(counterKey, ONE_DAY_SECONDS);
    if (count > SIGNUP_LIMIT_PER_IP_PER_DAY) {
      return res.status(429).json({
        error: {
          message: "Terlalu banyak percobaan signup dari alamat ini. Coba lagi besok.",
          type: "rate_limit_error"
        }
      });
    }
  } catch (e) {
    // Redis lagi down — jangan block signup, cukup log.
    console.error("Signup rate limit check gagal:", e.message);
  }

  next();
}

module.exports.signupRateLimit = signupRateLimit;
