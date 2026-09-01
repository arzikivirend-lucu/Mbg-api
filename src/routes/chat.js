const express = require("express");
const { resolveModel } = require("../config/models");
const { callGroq } = require("../lib/groq");
const { searchWeb, needsWebSearch, getLastUserText, buildSearchContextMessage } = require("../lib/tavily");

const router = express.Router();

// Sisipkan hasil Tavily sebagai system message tambahan sebelum messages asli,
// kalau: (a) klien eksplisit minta `web_search: true`, atau (b) tidak eksplisit
// `false` dan pesan terakhir user mengandung kata kunci pemicu (mis. "hari ini",
// "harga", "berita terbaru"). Gagal search tidak boleh menggagalkan chat —
// cukup lanjut tanpa konteks pencarian.
async function withWebSearchContext(messages, webSearchOption) {
  const lastUserText = getLastUserText(messages);
  const shouldSearch =
    webSearchOption === true || (webSearchOption !== false && needsWebSearch(lastUserText));

  if (!shouldSearch || !lastUserText) {
    return { messages, webSearchUsed: false };
  }

  try {
    const result = await searchWeb(lastUserText);
    const contextMessage = buildSearchContextMessage(result, lastUserText);
    return { messages: [contextMessage, ...messages], webSearchUsed: true };
  } catch (err) {
    console.error("Tavily search gagal, lanjut tanpa web search:", err.message);
    return { messages, webSearchUsed: false };
  }
}

router.post("/completions", async (req, res) => {
  const { model, messages, stream, temperature, max_tokens, web_search } = req.body || {};

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
    const { messages: augmentedMessages, webSearchUsed } = await withWebSearchContext(messages, web_search);

    if (stream) {
      const groqRes = await callGroq({
        model: modelConfig.groqModel,
        messages: augmentedMessages,
        stream: true,
        temperature,
        max_tokens
      });

      res.setHeader("X-Web-Search-Used", String(webSearchUsed));

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
      messages: augmentedMessages,
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
      usage: data.usage,
      web_search_used: webSearchUsed
    });
  } catch (err) {
    const status = err.status && err.status < 500 ? err.status : 502;
    return res.status(status).json({
      error: { message: err.message || "Terjadi kesalahan saat menghubungi model.", type: "upstream_error" }
    });
  }
});

module.exports = router;
