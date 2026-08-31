// Client untuk deAPI.ai (text-to-image), disalin persis pola dari server.js
// produksi kamu: submit job async -> balas requestId cepat -> frontend/klien
// polling status setiap 1-2 detik sampai selesai. Ini penting karena generate
// gambar bisa lebih lama dari timeout function serverless kalau ditunggu sinkron.

const DEAPI_BASE = "https://api.deapi.ai/api/v1/client";
const DEAPI_MODEL = "ZImageTurbo_INT8"; // model cepat, cocok untuk chat realtime

function deapiHeaders() {
  return {
    Authorization: `Bearer ${process.env.DEAPI_API_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json"
  };
}

async function submitImageJob(prompt) {
  if (!process.env.DEAPI_API_KEY) {
    throw new Error("DEAPI_API_KEY belum di-set di environment variables.");
  }

  const resp = await fetch(`${DEAPI_BASE}/txt2img`, {
    method: "POST",
    headers: deapiHeaders(),
    body: JSON.stringify({
      prompt: `${prompt}, high quality, detailed, beautiful`,
      model: DEAPI_MODEL,
      width: 768,
      height: 512,
      steps: 4,
      seed: -1
    })
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`deAPI submit error (${resp.status}): ${errText}`);
  }

  const data = await resp.json();
  const requestId = data?.data?.request_id;
  if (!requestId) throw new Error("deAPI tidak mengembalikan request_id");
  return requestId;
}

const DONE_STATUSES = ["done", "completed", "success", "succeeded", "finished"];
const FAILED_STATUSES = ["failed", "error", "cancelled"];

async function checkImageJob(requestId) {
  if (!process.env.DEAPI_API_KEY) {
    throw new Error("DEAPI_API_KEY belum di-set di environment variables.");
  }

  const resp = await fetch(`${DEAPI_BASE}/request-status/${requestId}`, {
    headers: deapiHeaders()
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`deAPI status error (${resp.status}): ${errText}`);
  }

  const statusData = await resp.json();
  const d = statusData?.data || statusData;
  const rawStatus = (d?.status || "").toLowerCase();

  if (DONE_STATUSES.includes(rawStatus)) {
    const imageUrl =
      d?.result_url ||
      d?.result?.url ||
      d?.result?.[0]?.url ||
      d?.result?.image_url ||
      d?.output_url ||
      d?.output?.[0]?.url ||
      d?.output?.url ||
      d?.url ||
      d?.download_url ||
      d?.assets?.[0]?.url ||
      d?.results_alt_formats?.jpg ||
      d?.results_alt_formats?.webp ||
      null;

    if (!imageUrl) {
      return { status: "done", imageUrl: null, debugRaw: statusData };
    }
    return { status: "completed", imageUrl };
  }

  if (FAILED_STATUSES.includes(rawStatus)) {
    return { status: "failed", error: d?.error || d?.error_message || "Gagal membuat gambar" };
  }

  return { status: rawStatus || "pending" };
}

module.exports = { submitImageJob, checkImageJob };
