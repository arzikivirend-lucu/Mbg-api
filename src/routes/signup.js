const express = require("express");
const { createApiKey, findKeyByEmail } = require("../lib/apiKey");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /v1/signup — endpoint publik (TANPA x-admin-secret), dipakai form
// signup.html di website supaya user bisa generate API key sendiri (plan
// "free"), tanpa kartu kredit / approval manual. Satu email hanya boleh
// generate satu key.
router.post("/", async (req, res) => {
  const { name, email } = req.body || {};

  if (!email || !EMAIL_RE.test(String(email).trim())) {
    return res.status(400).json({
      error: { message: "Field 'email' wajib diisi dengan format yang valid.", type: "invalid_request_error" }
    });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanName = (name || "").trim();

  try {
    const existingKey = await findKeyByEmail(cleanEmail);
    if (existingKey) {
      return res.status(409).json({
        error: {
          message: "Email ini sudah pernah generate API key sebelumnya. Cek email/catatan kamu — key tidak ditampilkan ulang di sini.",
          type: "already_exists"
        }
      });
    }

    const key = await createApiKey({ ownerName: cleanName, email: cleanEmail, plan: "free" });
    res.json({
      api_key: key,
      plan: "free",
      note: "Simpan key ini sekarang — tidak akan ditampilkan lagi."
    });
  } catch (e) {
    res.status(500).json({ error: { message: e.message, type: "server_error" } });
  }
});

module.exports = router;
