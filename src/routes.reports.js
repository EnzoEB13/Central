const express = require("express");
const pool = require("./db");
const { requireJWT } = require("./middleware.auth");
const { mysqlUtcToArgentina, ARG_TZ } = require("./util.time");

const router = express.Router();
router.use(requireJWT);

// GET /api/reports/daily?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&buildingId=
router.get("/reports/daily", async (req, res) => {
  const { desde, hasta, buildingId } = req.query;

  const where = [];
  const params = [];

  if (buildingId) { where.push("b.id=?"); params.push(Number(buildingId)); }
  if (desde) { where.push("a.record_time_utc >= ?"); params.push(`${desde} 00:00:00`); }
  if (hasta) { where.push("a.record_time_utc <= ?"); params.push(`${hasta} 23:59:59.999`); }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // Agrupamos por día (en Argentina), empleado (si está mapeado) y por device_user_id como fallback.
  const [rows] = await pool.query(
    `
    SELECT
      b.id AS buildingId,
      b.name AS buildingName,

      COALESCE(e.id, 0) AS employeeId,
      COALESCE(CONCAT(e.last_name, ', ', e.first_name), CONCAT('DeviceUser ', a.device_user_id)) AS employeeName,

      a.device_user_id AS deviceUserId,

      -- Día calculado en Argentina (usamos offset -03 fijo, Argentina no usa DST)
      DATE(DATE_ADD(a.record_time_utc, INTERVAL -3 HOUR)) AS dayAr,

      MIN(a.record_time_utc) AS firstUtc,
      MAX(a.record_time_utc) AS lastUtc,
      COUNT(*) AS marks

    FROM attendance_logs a
    JOIN devices d ON d.id = a.device_id
    JOIN buildings b ON b.id = d.building_id
    LEFT JOIN employee_device_map m
      ON m.device_id = a.device_id AND m.device_user_id = a.device_user_id
    LEFT JOIN employees e ON e.id = m.employee_id

    ${whereSql}
    GROUP BY buildingId, buildingName, employeeId, employeeName, deviceUserId, dayAr
    ORDER BY dayAr DESC, buildingName, employeeName
    `,
    params
  );

  const out = rows.map(r => ({
    ...r,
    firstArgentina: mysqlUtcToArgentina(r.firstUtc),
    lastArgentina: mysqlUtcToArgentina(r.lastUtc),
    argTz: ARG_TZ
  }));

  res.json(out);
});

module.exports = router;
