const express = require("express");
const { redis } = require("../lib/redis");
const { getKeyByEmail, createSelfSignupKey } = require("../lib/apiKey");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Batas percobaan signup per IP per hari, biar endpoint publik ini tidak
// dipakai buat generate ribuan API key sekaligus (spam/abuse).
const MAX_SIGNUPS_PER_IP_PER_DAY = 5;
const ONE_DAY_SECONDS = 24 * 60 * 60;

function getClientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return String(fwd).split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

// POST /v1/signup — endpoint publik, TANPA x-admin-secret / API key.
// Siapapun yang isi nama + email dapat API key plan "free" secara otomatis.
router.post("/", async (req, res) => {
  const { name, email } = req.body || {};

  if (!email || !EMAIL_RE.test(String(email).trim())) {
    return res.status(400).json({
      error: { message: "Email tidak valid.", type: "invalid_request_error" }
    });
  }

  try {
    // 1 email = 1 key. Kalau sudah pernah signup, balikin key yang sama
    // (bukan generate baru) supaya tidak numpuk key di Redis.
    const existingKey = await getKeyByEmail(email);
    if (existingKey) {
      return res.json({
        api_key: existingKey,
        existing: true,
        note: "Kamu sudah pernah daftar dengan email ini. Ini API key yang sama seperti sebelumnya."
      });
    }

    // Rate limit signup per IP per hari.
    const ip = getClientIp(req);
    const ipCounterKey = `signup_ip:${ip}:${new Date().toISOString().slice(0, 10)}`;
    const attempts = await redis.incrWithExpire(ipCounterKey, ONE_DAY_SECONDS);
    if (attempts > MAX_SIGNUPS_PER_IP_PER_DAY) {
      return res.status(429).json({
        error: {
          message: "Terlalu banyak percobaan signup dari alamat ini. Coba lagi besok.",
          type: "rate_limit_error"
        }
      });
    }

    const key = await createSelfSignupKey({ ownerName: name, email });
    res.json({
      api_key: key,
      plan: "free",
      existing: false,
      note: "Simpan key ini sekarang — tidak akan ditampilkan lagi di halaman ini."
    });
  } catch (e) {
    res.status(500).json({ error: { message: e.message, type: "server_error" } });
  }
});

module.exports = router;
