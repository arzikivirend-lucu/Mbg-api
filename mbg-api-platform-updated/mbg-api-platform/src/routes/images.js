const express = require("express");
const { submitImageJob, checkImageJob } = require("../lib/deapi");

const router = express.Router();

// POST /v1/images/generations -> submit job, balas cepat dengan requestId
router.post("/", async (req, res) => {
  const { prompt, model } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: { message: "Field 'prompt' wajib diisi.", type: "invalid_request_error" } });
  }
  if (model && model !== "mindbot-v2.5") {
    return res.status(400).json({
      error: { message: `Model '${model}' tidak mendukung image generation. Gunakan 'mindbot-v2.5'.`, type: "invalid_request_error" }
    });
  }

  try {
    const requestId = await submitImageJob(prompt);
    res.json({ request_id: requestId, status: "pending" });
  } catch (err) {
    res.status(502).json({ error: { message: err.message, type: "upstream_error" } });
  }
});

// GET /v1/images/generations/:requestId -> poll status (panggil tiap 1-2 detik dari klien)
router.get("/:requestId", async (req, res) => {
  try {
    const result = await checkImageJob(req.params.requestId);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: { message: err.message, type: "upstream_error" } });
  }
});

module.exports = router;
