const express = require("express");
const pool = require("./db");
const { requireJWT } = require("./middleware.auth");
const { mysqlUtcToArgentina } = require("./util.time");

const router = express.Router();
router.use(requireJWT);

// GET /api/buildings
router.get("/buildings", async (req, res) => {
  const [rows] = await pool.query(`SELECT id, code, name, address FROM buildings ORDER BY name`);
  res.json(rows);
});

// GET /api/devices
router.get("/devices", async (req, res) => {
  const [rows] = await pool.query(`
    SELECT d.id, d.name, d.ip, d.is_active AS isActive, d.last_seen_at AS lastSeenAt,
           b.id AS buildingId, b.name AS buildingName, b.code AS buildingCode
    FROM devices d
    JOIN buildings b ON b.id = d.building_id
    ORDER BY b.name, d.name
  `);
  res.json(rows);
});

// GET /api/device-users?deviceId=1&q=
router.get("/device-users", async (req, res) => {
  const { deviceId, q } = req.query;
  const where = [];
  const params = [];

  if (deviceId) { where.push("du.device_id=?"); params.push(Number(deviceId)); }
  if (q) { where.push("(du.name LIKE ? OR du.device_user_id LIKE ?)"); params.push(`%${q}%`,`%${q}%`); }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [rows] = await pool.query(
    `
    SELECT du.*, d.name AS deviceName, b.name AS buildingName
    FROM device_users du
    JOIN devices d ON d.id = du.device_id
    JOIN buildings b ON b.id = d.building_id
    ${whereSql}
    ORDER BY b.name, d.name, du.device_user_id
    LIMIT 1000
    `,
    params
  );
  res.json(rows);
});

// GET /api/attendances?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&buildingId=&employeeId=&deviceId=&limit=&offset=
router.get("/attendances", async (req, res) => {
  const {
    desde, hasta,
    buildingId, deviceId,
    employeeId,
    limit = 500, offset = 0
  } = req.query;

  const where = [];
  const params = [];

  if (buildingId) { where.push("b.id=?"); params.push(Number(buildingId)); }
  if (deviceId) { where.push("d.id=?"); params.push(Number(deviceId)); }
  if (employeeId) { where.push("m.employee_id=?"); params.push(Number(employeeId)); }

  if (desde) { where.push("a.record_time_utc >= ?"); params.push(`${desde} 00:00:00`); }
  if (hasta) { where.push("a.record_time_utc <= ?"); params.push(`${hasta} 23:59:59.999`); }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `
    SELECT
      a.id,
      a.record_time_utc AS recordTimeUtc,
      a.user_sn AS userSn,
      a.device_user_id AS deviceUserId,

      d.id AS deviceId,
      d.name AS deviceName,
      d.ip,
      b.id AS buildingId,
      b.name AS buildingName,

      -- 👉 EMPLEADO SI EXISTE
      e.id AS employeeId,
      CONCAT(e.last_name, ', ', e.first_name) AS employeeName,

      -- 👉 FALLBACK: nombre del usuario del reloj
      du.name AS deviceUserName

    FROM attendance_logs a
    JOIN devices d ON d.id = a.device_id
    JOIN buildings b ON b.id = d.building_id

    LEFT JOIN device_users du
      ON du.device_id = a.device_id
     AND du.device_user_id = a.device_user_id

    LEFT JOIN employee_device_map m
      ON m.device_id = a.device_id
     AND m.device_user_id = a.device_user_id

    LEFT JOIN employees e
      ON e.id = m.employee_id

    ${whereSql}
    ORDER BY a.record_time_utc DESC
    LIMIT ? OFFSET ?
    `,
    [...params, Number(limit), Number(offset)]
  );

  // ⏰ convertir horario
  const out = rows.map(r => ({
    ...r,
    recordTimeArgentina: mysqlUtcToArgentina(r.recordTimeUtc),

    // 👇 nombre final para mostrar
    displayName: r.employeeName || r.deviceUserName || `User ${r.deviceUserId}`
  }));

  res.json(out);
});

module.exports = router;
