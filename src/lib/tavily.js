// Client untuk Tavily Search API — dipindahkan & dirapikan dari pola
// `needsWebSearch` / `searchWeb` yang sudah ada di server.js produksi
// (NOVA AI, dst). Dipakai supaya chat completion bisa "nyambung" ke
// informasi terkini (berita, harga, cuaca, dsb) sebelum dijawab Groq.

const TAVILY_URL = "https://api.tavily.com/search";

// Kata kunci pemicu pencarian otomatis (ID + EN). Sengaja heuristik
// sederhana, sama seperti pola production: lebih baik kadang search
// yang tidak perlu, daripada model menjawab ngasal soal info terkini.
const TRIGGER_KEYWORDS = [
  "hari ini", "sekarang", "terkini", "terbaru", "baru-baru ini",
  "berita", "kabar", "cuaca", "harga", "kurs", "skor", "hasil pertandingan",
  "siapa presiden", "siapa ketua", "siapa ceo", "kapan rilis", "jadwal",
  "update", "viral", "trending", "tanggal berapa", "bulan ini", "tahun ini",
  "latest", "today", "current", "news", "weather", "price of", "score",
  "who is the current", "when is", "release date", "stock price"
];

function needsWebSearch(text) {
  if (!text || typeof text !== "string") return false;
  const lower = text.toLowerCase();
  return TRIGGER_KEYWORDS.some((kw) => lower.includes(kw));
}

// Ambil teks polos dari isi pesan terakhir user, baik yang berupa string
// biasa maupun array content (format vision: [{type:"text",...}, {type:"image_url",...}]).
function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((c) => c && c.type === "text" && typeof c.text === "string")
      .map((c) => c.text)
      .join(" ");
  }
  return "";
}

function getLastUserText(messages) {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") return extractText(messages[i].content);
  }
  return "";
}

async function searchWeb(query, { maxResults = 5 } = {}) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY belum di-set di environment variables.");
  }

  const res = await fetch(TAVILY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      topic: "general",
      max_results: maxResults,
      include_answer: true
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    const err = new Error(`Tavily API error ${res.status}: ${errText}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  return {
    answer: data.answer || null,
    results: (data.results || []).map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content
    }))
  };
}

// Bangun system message tambahan berisi hasil pencarian + tanggal/jam
// sekarang (WIB), supaya model tahu konteks waktu saat ini — sama seperti
// dynamic system prompt di NOVA AI.
function buildSearchContextMessage({ answer, results }, query) {
  const now = new Date();
  const timeStr = now.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "full",
    timeStyle: "short"
  });

  const sourcesText = results
    .map((r, i) => `${i + 1}. ${r.title} (${r.url})\n${r.content}`)
    .join("\n\n");

  const content = [
    `Waktu saat ini: ${timeStr} WIB.`,
    `Hasil pencarian web untuk "${query}":`,
    answer ? `Ringkasan: ${answer}` : null,
    sourcesText || "(tidak ada hasil relevan)",
    "Gunakan informasi di atas untuk menjawab jika relevan, dan sebutkan bahwa informasi berasal dari pencarian web bila perlu. Jangan mengarang informasi di luar ini untuk hal yang bersifat terkini."
  ]
    .filter(Boolean)
    .join("\n\n");

  return { role: "system", content };
}

module.exports = { searchWeb, needsWebSearch, getLastUserText, buildSearchContextMessage };
