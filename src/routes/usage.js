const express = require("express");
const { redis } = require("../lib/redis");
const { PLAN_LIMITS } = require("../middleware/rateLimit");

const router = express.Router();

router.get("/", async (req, res) => {
  if (req.auth.type === "internal") {
    return res.json({ type: "internal", unlimited: true });
  }
  const { key, record } = req.auth;
  const today = new Date().toISOString().slice(0, 10);
  const used = Number((await redis.get(`usage:${key}:${today}`)) || 0);
  const plan = record.plan || "free";
  const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

  res.json({ plan, date: today, used, limit, remaining: Math.max(0, limit - used) });
});

module.exports = router;
