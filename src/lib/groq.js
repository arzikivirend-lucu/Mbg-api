const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Panggil Groq. Kalau stream=true, kembalikan Response mentah (body-nya
 * di-pipe langsung ke client di route handler). Kalau tidak, kembalikan
 * JSON hasil parse.
 */
async function callGroq({ model, messages, stream, temperature, max_tokens }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY belum di-set di environment variables.");
  }

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages,
      stream: !!stream,
      temperature: temperature ?? 0.7,
      max_tokens: max_tokens ?? 1024
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    const err = new Error(`Groq API error ${res.status}: ${errText}`);
    err.status = res.status;
    throw err;
  }

  if (stream) {
    return res; // caller akan pipe res.body
  }
  return res.json();
}

module.exports = { callGroq };
