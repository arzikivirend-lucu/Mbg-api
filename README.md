# Mindbot Genius API Platform

Backend API nyata (bukan mock) untuk website Mindbot Genius, sekaligus siap dibuka
jadi API publik dengan sistem API key + rate limit — mirip cara kerja API OpenAI/Groq.

## Kenapa strukturnya begini

- **Vercel serverless tidak punya filesystem yang persist**, jadi API key dan
  hitungan pemakaian (usage) disimpan di **Upstash Redis** (REST, gratis untuk skala
  kecil-menengah), bukan file lokal atau variabel in-memory — supaya beneran jalan
  konsisten di production, bukan cuma pas testing lokal.
- **Dua jalur auth**: website kamu sendiri pakai `x-internal-secret` (tanpa limit),
  developer luar nanti pakai `Authorization: Bearer mbg_live_xxx` (kena rate limit
  sesuai plan).
- **Nama model tetap branded** (`mindbot-v1.0`, `genius-v2.5`, dst) di API publik,
  dipetakan ke model Groq asli di `src/config/models.js` — jadi kalau nanti ganti
  model di belakang layar, kontrak API ke pengguna tidak berubah.
- **Streaming asli** lewat pipe langsung dari response Groq ke client (SSE), bukan
  nunggu semua lalu kirim sekaligus.

## Setup

1. `npm install`
2. Bikin akun gratis di [upstash.com](https://upstash.com), buat Redis database,
   salin `UPSTASH_REDIS_REST_URL` dan `UPSTASH_REDIS_REST_TOKEN`.
3. Copy `.env.example` jadi `.env`, isi semua value (GROQ_API_KEY sama seperti yang
   sudah kamu pakai di app lain).
4. `npm run dev` — jalan di `http://localhost:3001`

## Deploy ke Vercel

Sama seperti app kamu yang lain: connect repo ini ke Vercel, lalu isi semua
environment variable dari `.env.example` di dashboard Vercel (Settings → Environment
Variables). `vercel.json` sudah mengarahkan semua request ke `api/index.js`.

## Endpoint

### Dari website kamu sendiri (internal, tanpa limit)

```bash
curl -X POST https://api-kamu.vercel.app/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-internal-secret: <INTERNAL_API_SECRET>" \
  -d '{
    "model": "mindbot-v1.5",
    "messages": [{ "role": "user", "content": "Halo!" }],
    "stream": false
  }'
```

Untuk streaming, set `"stream": true` — response-nya Server-Sent Events, bisa
langsung dikonsumsi `EventSource` atau `fetch` + `ReadableStream` di frontend.

### Bikin API key publik (admin only)

```bash
curl -X POST https://api-kamu.vercel.app/v1/admin/keys \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: <ADMIN_SECRET>" \
  -d '{ "ownerName": "budi", "plan": "free" }'
```

Balikannya `{ "api_key": "mbg_live_xxxxxxxx" }` — simpan, tidak ditampilkan lagi.

### Pemakaian oleh developer luar (public)

```bash
curl -X POST https://api-kamu.vercel.app/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mbg_live_xxxxxxxx" \
  -d '{
    "model": "genius-v2.5",
    "messages": [{ "role": "user", "content": "Jelaskan machine learning" }]
  }'
```

Kena rate limit sesuai plan (`free` = 100 req/hari, `pro` = 5000 req/hari — atur di
`src/middleware/rateLimit.js`). Cek sisa kuota lewat `GET /v1/usage` dengan header
`Authorization` yang sama.

### Daftar model

```
GET /v1/models
```

### Image generation (Mindbot v2.5, via deAPI)

Pola async job + polling, sama seperti di server.js produksi kamu — submit
balas cepat dengan `request_id`, lalu klien polling status tiap 1-2 detik.

```bash
# 1. Submit
curl -X POST https://api-kamu.vercel.app/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "x-internal-secret: <INTERNAL_API_SECRET>" \
  -d '{ "prompt": "kucing astronot di bulan" }'
# -> { "request_id": "xxx", "status": "pending" }

# 2. Poll
curl https://api-kamu.vercel.app/v1/images/generations/xxx \
  -H "x-internal-secret: <INTERNAL_API_SECRET>"
# -> { "status": "completed", "imageUrl": "https://..." }
```

Butuh `DEAPI_API_KEY` di environment variables.

### Web search (Tavily) di dalam chat completions

`/v1/chat/completions` sekarang bisa menyisipkan hasil pencarian web (Tavily)
sebagai konteks tambahan sebelum menjawab — port dari pola `needsWebSearch`/
`searchWeb` di server.js lama, plus opsi eksplisit lewat body request:

- Default (tanpa field `web_search`): otomatis search kalau pesan terakhir user
  mengandung kata kunci pemicu ("hari ini", "berita", "harga", "terbaru", dst —
  lihat `TRIGGER_KEYWORDS` di `src/lib/tavily.js`).
- `"web_search": true` — paksa search apapun isi pesannya.
- `"web_search": false` — matikan sama sekali, meski ada kata kunci pemicu.

```bash
curl -X POST https://api-kamu.vercel.app/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-internal-secret: <INTERNAL_API_SECRET>" \
  -d '{
    "model": "genius-v2.5",
    "messages": [{ "role": "user", "content": "Berita AI terbaru hari ini apa?" }],
    "web_search": true
  }'
```

Respons non-streaming punya field tambahan `"web_search_used": true/false`.
Untuk streaming, cek header response `X-Web-Search-Used`. Kalau `TAVILY_API_KEY`
belum di-set atau request ke Tavily gagal, chat tetap lanjut jalan tanpa
konteks pencarian (tidak bikin request gagal).

## Yang belum termasuk (kasih tahu kalau mau ditambahkan)

- **Ingatan AI / memory extraction** (endpoint `/api/memory/extract` di server.js
  lama, yang menyimpan fakta pengguna di localStorage klien) — juga belum dipindah
  ke sini. Bisa ditambahkan sebagai `/v1/memory/extract` kalau kamu mau API publik
  juga punya fitur ini.
- **Billing/pembayaran** untuk upgrade plan — saat ini plan diatur manual lewat
  endpoint admin.
- **Dashboard web** untuk developer melihat/generate API key sendiri (saat ini
  masih lewat curl/admin).
