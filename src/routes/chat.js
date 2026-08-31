const express = require("express");
const { resolveModel } = require("../config/models");
const { callGroq } = require("../lib/groq");

const router = express.Router();

router.post("/completions", async (req, res) => {
  const { model, messages, stream, temperature, max_tokens } = req.body || {};

  if (!model) {
    return res.status(400).json({ error: { message: "Field 'model' wajib diisi.", type: "invalid_request_error" } });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: { message: "Field 'messages' wajib berupa array dan tidak boleh kosong.", type: "invalid_request_error" }
    });
  }

  const modelConfig = resolveModel(model);
  if (!modelConfig) {
    return res.status(400).json({
      error: { message: `Model '${model}' tidak dikenal. Cek GET /v1/models untuk daftar yang tersedia.`, type: "invalid_request_error" }
    });
  }

  try {
    if (stream) {
      const groqRes = await callGroq({
        model: modelConfig.groqModel,
        messages,
        stream: true,
        temperature,
        max_tokens
      });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();

      // Pipe langsung dari Groq ke client — ini kunci supaya streaming
      // "beneran jalan" dan bukan cuma nunggu lalu kirim sekaligus.
      const reader = groqRes.body.getReader();
      const decoder = new TextDecoder();
      req.on("close", () => reader.cancel().catch(() => {}));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
      return res.end();
    }

    const data = await callGroq({
      model: modelConfig.groqModel,
      messages,
      stream: false,
      temperature,
      max_tokens
    });

    // Normalisasi respons ke bentuk yang stabil untuk konsumen API,
    // supaya kalau nanti ganti provider di belakang, kontrak publik tidak berubah.
    return res.json({
      id: data.id,
      model, // kembalikan nama publik, bukan nama internal Groq
      created: data.created,
      choices: data.choices,
      usage: data.usage
    });
  } catch (err) {
    const status = err.status && err.status < 500 ? err.status : 502;
    return res.status(status).json({
      error: { message: err.message || "Terjadi kesalahan saat menghubungi model.", type: "upstream_error" }
    });
  }
});

module.exports = router;
