const express = require("express");
const pool = require("./db");
const { requireJWT, requireRole } = require("./middleware.auth");

const router = express.Router();

// Buildings
router.post("/admin/buildings", requireJWT, requireRole("admin"), async (req, res) => {
  const { code, name, address } = req.body || {};
  if (!code || !name) return res.status(400).json({ ok: false, error: "Missing code/name" });
  await pool.query(`INSERT INTO buildings (code, name, address) VALUES (?,?,?)`, [code, name, address || null]);
  res.json({ ok: true });
});

router.get("/admin/buildings", requireJWT, async (req, res) => {
  const [rows] = await pool.query(`SELECT * FROM buildings ORDER BY id DESC`);
  res.json(rows);
});

// Devices
router.post("/admin/devices", requireJWT, requireRole("admin"), async (req, res) => {
  const { buildingId, name, ip, deviceKey } = req.body || {};
  if (!buildingId || !name || !deviceKey) {
    return res.status(400).json({ ok: false, error: "Missing buildingId/name/deviceKey" });
  }

  await pool.query(
    `INSERT INTO devices (building_id, name, ip, device_key) VALUES (?,?,?,?)`,
    [Number(buildingId), name, ip || null, deviceKey]
  );
  res.json({ ok: true });
});

router.get("/admin/devices", requireJWT, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT d.*, b.name AS buildingName, b.code AS buildingCode
     FROM devices d JOIN buildings b ON b.id = d.building_id
     ORDER BY d.id DESC`
  );
  res.json(rows);
});

// Employees
router.post("/admin/employees", requireJWT, requireRole("admin","rrhh"), async (req, res) => {
  const { docId, firstName, lastName, email, phone } = req.body || {};
  if (!firstName || !lastName) return res.status(400).json({ ok: false, error: "Missing name" });

  await pool.query(
    `INSERT INTO employees (doc_id, first_name, last_name, email, phone)
     VALUES (?,?,?,?,?)`,
    [docId || null, firstName, lastName, email || null, phone || null]
  );
  res.json({ ok: true });
});

router.get("/admin/employees", requireJWT, async (req, res) => {
  const { q } = req.query;
  const params = [];
  let where = "";
  if (q) {
    where = `WHERE first_name LIKE ? OR last_name LIKE ? OR doc_id LIKE ?`;
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const [rows] = await pool.query(
    `SELECT * FROM employees ${where} ORDER BY id DESC LIMIT 500`,
    params
  );
  res.json(rows);
});

// Map device user -> employee
router.post("/admin/map", requireJWT, requireRole("admin","rrhh"), async (req, res) => {
  const { employeeId, deviceId, deviceUserId } = req.body || {};
  if (!employeeId || !deviceId || !deviceUserId) {
    return res.status(400).json({ ok: false, error: "Missing employeeId/deviceId/deviceUserId" });
  }

  await pool.query(
    `INSERT INTO employee_device_map (employee_id, device_id, device_user_id)
     VALUES (?,?,?)
     ON DUPLICATE KEY UPDATE employee_id = VALUES(employee_id)`,
    [Number(employeeId), Number(deviceId), String(deviceUserId)]
  );

  res.json({ ok: true });
});

module.exports = router;
