require("dotenv").config();
const express = require("express");

const authRoutes = require("./routes.auth");
const adminRoutes = require("./routes.admin");
const readRoutes = require("./routes.read");
const reportRoutes = require("./routes.reports");
const syncRoutes = require("./routes.sync");

const app = express();
app.use(express.json({ limit: "10mb" }));

app.get("/health", (req, res) => res.json({ ok: true }));

// ===============================
// 1️⃣ SYNC DESDE DISPOSITIVOS
// ❗ NO JWT – SOLO x-device-key
// ===============================
app.use("/api/sync", syncRoutes);

// ===============================
// 2️⃣ AUTH (login)
// ===============================
app.use("/api", authRoutes);

// ===============================
// 3️⃣ ADMIN + READ + REPORTS
// ❗ JWT REQUERIDO
// ===============================
app.use("/api", adminRoutes);
app.use("/api", readRoutes);
app.use("/api", reportRoutes);

const port = process.env.PORT || 3000;
app.listen(port, () =>
  console.log(`Central server on http://localhost:${port}`)
);
