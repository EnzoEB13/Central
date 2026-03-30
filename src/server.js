require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes.auth");
const adminRoutes = require("./routes.admin");
const readRoutes = require("./routes.read");
const reportRoutes = require("./routes.reports");
const syncRoutes = require("./routes.sync");
const calendarRoutes = require("./routes.calendar");

const app = express();

// ✅ CORS
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://127.0.0.1:5173"
  ],
  credentials: false,
}));

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
// 3️⃣ ADMIN + READ + REPORTS + CALENDAR
// ❗ JWT REQUERIDO
// ===============================
app.use("/api", adminRoutes);
app.use("/api", readRoutes);
app.use("/api", reportRoutes);
app.use("/api", calendarRoutes);

const port = process.env.PORT || 3000;
app.listen(port, () =>
  console.log(`Central server on http://localhost:${port}`)
);