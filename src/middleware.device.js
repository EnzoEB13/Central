const pool = require("./db");

async function requireDevice(req, res, next) {
  const key = req.headers["x-device-key"];
  if (!key) return res.status(401).json({ ok: false, error: "Missing x-device-key" });

  const [rows] = await pool.query(
    `SELECT id, building_id AS buildingId, name, ip, is_active AS isActive
     FROM devices WHERE device_key = ? LIMIT 1`,
    [key]
  );

  if (!rows.length) return res.status(401).json({ ok: false, error: "Invalid device key" });
  if (!rows[0].isActive) return res.status(403).json({ ok: false, error: "Device disabled" });

  req.device = rows[0];

  // actualizar last_seen
  await pool.query(`UPDATE devices SET last_seen_at = NOW() WHERE id = ?`, [req.device.id]);

  next();
}

module.exports = { requireDevice };
