const express = require("express");
const { requireAdmin } = require("../middleware/auth");
const { createApiKey, revokeApiKey } = require("../lib/apiKey");

const router = express.Router();

// Semua endpoint di sini butuh header x-admin-secret (lihat .env ADMIN_SECRET)
router.use(requireAdmin);

router.post("/", async (req, res) => {
  const { ownerName, plan } = req.body || {};
  try {
    const key = await createApiKey({ ownerName, plan });
    res.json({
      api_key: key,
      note: "Simpan key ini sekarang — tidak akan ditampilkan lagi."
    });
  } catch (e) {
    res.status(500).json({ error: { message: e.message, type: "server_error" } });
  }
});

router.post("/:key/revoke", async (req, res) => {
  try {
    await revokeApiKey(req.params.key);
    res.json({ revoked: true });
  } catch (e) {
    res.status(500).json({ error: { message: e.message, type: "server_error" } });
  }
});

module.exports = router;
