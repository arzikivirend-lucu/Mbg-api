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
