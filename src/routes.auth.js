const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("./db");
const { requireJWT, requireRole } = require("./middleware.auth");

const router = express.Router();

router.post("/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ ok: false, error: "Missing credentials" });

  const [rows] = await pool.query(
    `SELECT id, username, password_hash AS hash, role, is_active AS isActive
     FROM app_users WHERE username = ? LIMIT 1`,
    [username]
  );

  if (!rows.length || !rows[0].isActive) return res.status(401).json({ ok: false, error: "Invalid login" });

  const ok = await bcrypt.compare(password, rows[0].hash);
  if (!ok) return res.status(401).json({ ok: false, error: "Invalid login" });

  const token = jwt.sign(
    { uid: rows[0].id, username: rows[0].username, role: rows[0].role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES || "12h" }
  );

  res.json({ ok: true, token });
});

// Crear usuarios del panel (solo admin)
router.post("/auth/users", requireJWT, requireRole("admin"), async (req, res) => {
  const { username, password, role = "rrhh" } = req.body || {};
  if (!username || !password) return res.status(400).json({ ok: false, error: "Missing username/password" });

  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO app_users (username, password_hash, role) VALUES (?,?,?)`,
    [username, hash, role]
  );

  res.json({ ok: true });
});

module.exports = router;
