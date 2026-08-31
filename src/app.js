require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

const { requireAuth } = require("./middleware/auth");
const { rateLimit } = require("./middleware/rateLimit");

const chatRoutes = require("./routes/chat");
const modelsRoutes = require("./routes/models");
const keysRoutes = require("./routes/keys");
const usageRoutes = require("./routes/usage");
const imagesRoutes = require("./routes/images");
const signupRoutes = require("./routes/signup");

const app = express();

// Ganti "*" dengan domain website kamu di production (mis. https://mindbot-genius-ai.vercel.app)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "*").split(",").map((s) => s.trim());
app.use(
  cors({
    origin: allowedOrigins.includes("*") ? true : allowedOrigins,
    credentials: true
  })
);
app.use(express.json({ limit: "10mb" }));

// Halaman statis publik, termasuk /signup.html tempat pengguna dapat API key sendiri.
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/", (req, res) => {
  res.json({ name: "Mindbot Genius API Platform", status: "online", docs: "/v1/models" });
});

app.get("/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Endpoint publik yang dilindungi auth + rate limit
app.use("/v1/models", requireAuth, modelsRoutes);
app.use("/v1/chat", requireAuth, rateLimit, chatRoutes);
app.use("/v1/images/generations", requireAuth, rateLimit, imagesRoutes);
app.use("/v1/usage", requireAuth, usageRoutes);

// Endpoint admin (bikin/cabut API key) — pakai secret sendiri, bukan requireAuth biasa
app.use("/v1/admin/keys", keysRoutes);

// Endpoint signup publik (bikin API key plan "free" sendiri) — tanpa auth,
// tapi dibatasi per-IP & 1 key per email (lihat src/routes/signup.js)
app.use("/v1/signup", signupRoutes);

// 404 & error handler
app.use((req, res) => {
  res.status(404).json({ error: { message: "Endpoint tidak ditemukan.", type: "not_found" } });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: { message: "Kesalahan server internal.", type: "server_error" } });
});

module.exports = app;
