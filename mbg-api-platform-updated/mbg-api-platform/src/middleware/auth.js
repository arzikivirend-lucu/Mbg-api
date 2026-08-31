const { getApiKeyRecord } = require("../lib/apiKey");

/**
 * Dua jalur auth:
 * 1. INTERNAL_API_SECRET (header x-internal-secret) -> dipakai oleh website
 *    Mindbot Genius kamu sendiri, bypass rate limit publik.
 * 2. Authorization: Bearer mbg_live_xxx -> API key publik (untuk developer luar
 *    nanti), kena rate limit sesuai plan.
 *
 * req.auth diisi { type: "internal" } atau { type: "public", key, record }
 */
async function requireAuth(req, res, next) {
  const internalSecret = req.headers["x-internal-secret"];
  if (internalSecret && process.env.INTERNAL_API_SECRET && internalSecret === process.env.INTERNAL_API_SECRET) {
    req.auth = { type: "internal" };
    return next();
  }

  const authHeader = req.headers["authorization"] || "";
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const key = bearerMatch ? bearerMatch[1].trim() : null;

  if (!key) {
    return res.status(401).json({
      error: {
        message: "Autentikasi diperlukan. Kirim header 'Authorization: Bearer <api_key>'.",
        type: "authentication_error"
      }
    });
  }

  let record;
  try {
    record = await getApiKeyRecord(key);
  } catch (e) {
    return res.status(500).json({ error: { message: e.message, type: "server_error" } });
  }

  if (!record || record.active !== "true") {
    return res.status(401).json({
      error: { message: "API key tidak valid atau sudah dinonaktifkan.", type: "authentication_error" }
    });
  }

  req.auth = { type: "public", key, record };
  next();
}

// Middleware terpisah untuk endpoint admin (bikin/cabut API key)
function requireAdmin(req, res, next) {
  const secret = req.headers["x-admin-secret"];
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: { message: "Admin secret tidak valid.", type: "permission_error" } });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
