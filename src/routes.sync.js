const express = require("express");
const pool = require("./db");
const { requireDevice } = require("./middleware.device");
const { isoToMysqlUtc } = require("./util.time");

const router = express.Router();

// Todas las rutas de sync requieren device auth
router.use(requireDevice);

// POST /api/sync/usuarios
router.post("/usuarios", async (req, res) => {
  try {
    const usuarios = req.body?.usuarios || req.body;
    if (!Array.isArray(usuarios)) return res.status(400).json({ ok: false, error: "usuarios debe ser array" });

    const deviceId = req.device.id;

    let upserts = 0;
    for (const u of usuarios) {
      if (!u?.userId) continue;
      await pool.query(
        `
        INSERT INTO device_users
          (device_id, device_uid, device_user_id, name, role, password, cardno)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          device_uid = VALUES(device_uid),
          name = VALUES(name),
          role = VALUES(role),
          password = VALUES(password),
          cardno = VALUES(cardno)
        `,
        [
          deviceId,
          u.uid ?? null,
          String(u.userId),
          u.name ?? null,
          u.role ?? null,
          u.password ?? null,
          u.cardno ?? null
        ]
      );
      upserts++;
    }

    res.json({ ok: true, deviceId, upserts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Error interno" });
  }
});

// POST /api/sync/asistencias
router.post("/asistencias", async (req, res) => {
  try {
    const asistencias = req.body?.asistencias || req.body;
    if (!Array.isArray(asistencias)) return res.status(400).json({ ok: false, error: "asistencias debe ser array" });

    const deviceId = req.device.id;

    let inserted = 0;
    let ignored = 0;

    for (const a of asistencias) {
      if (a?.userSn == null || a?.deviceUserId == null || !a?.recordTime) continue;

      const mysqlUtc = isoToMysqlUtc(a.recordTime);
      if (!mysqlUtc) continue;

      try {
        await pool.query(
          `
          INSERT INTO attendance_logs
            (device_id, user_sn, device_user_id, record_time_utc)
          VALUES (?, ?, ?, ?)
          `,
          [deviceId, a.userSn, String(a.deviceUserId), mysqlUtc]
        );
        inserted++;
      } catch (e) {
        if (e && e.code === "ER_DUP_ENTRY") ignored++;
        else throw e;
      }
    }

    res.json({ ok: true, deviceId, inserted, ignored, total: asistencias.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Error interno" });
  }
});

module.exports = router;
