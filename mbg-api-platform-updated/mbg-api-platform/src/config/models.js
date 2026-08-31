// Peta nama model "branded" Mindbot Genius -> model id asli.
// Diselaraskan dengan server.js produksi kamu (bukan tebakan lagi):
// ALLOWED_MODELS asli: openai/gpt-oss-120b, openai/gpt-oss-20b, qwen/qwen3.6-27b
// Vision selalu pakai qwen/qwen3.6-27b, default text pakai openai/gpt-oss-120b.

const MODELS = {
  "mindbot-v1.0": {
    provider: "groq",
    groqModel: "openai/gpt-oss-120b",
    label: "Mindbot v1.0",
    description: "Model default, serba bisa",
    vision: false
  },
  "mindbot-v1.5": {
    provider: "groq",
    groqModel: "openai/gpt-oss-20b",
    label: "Mindbot v1.5",
    description: "Super cepat & ringan",
    vision: false
  },
  "genius-v1.5": {
    provider: "groq",
    groqModel: "qwen/qwen3.6-27b",
    label: "Genius v1.5",
    description: "Reasoning & vision",
    vision: true
  },
  "genius-v2.5": {
    provider: "groq",
    groqModel: "openai/gpt-oss-120b",
    label: "Genius v2.5",
    description: "Paling cerdas, konteks 131K",
    vision: false,
    contextWindow: 131072
  },
  "mindbot-v2.0": {
    provider: "groq",
    groqModel: "qwen/qwen3.6-27b",
    label: "Mindbot v2.0",
    description: "Analisis gambar & teks",
    vision: true
  }
  // "mindbot-v2.5" (image gen) bukan chat-completion -> lihat src/routes/images.js
};

function resolveModel(publicName) {
  return MODELS[publicName] || null;
}

const IMAGE_MODEL = {
  id: "mindbot-v2.5",
  label: "Mindbot v2.5",
  description: "Generate gambar dari teks (deAPI)",
  type: "image",
  endpoint: "/v1/images/generations"
};

function listModels() {
  const chatModels = Object.entries(MODELS).map(([id, m]) => ({
    id,
    type: "chat",
    label: m.label,
    description: m.description,
    vision: !!m.vision,
    context_window: m.contextWindow || null
  }));
  return [...chatModels, IMAGE_MODEL];
}

module.exports = { MODELS, resolveModel, listModels };
