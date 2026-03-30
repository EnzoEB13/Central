const express = require("express");
const pool = require("./db");
const { requireJWT, requireRole } = require("./middleware.auth");

const router = express.Router();
router.use(requireJWT);

function isDateOnly(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function parseDateUtc(dateStr) {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function expandDateRange(startDate, endDate) {
  const out = [];
  const current = parseDateUtc(startDate);
  const last = parseDateUtc(endDate);

  while (current <= last) {
    out.push(formatDateOnly(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return out;
}

function applyRangeFilters(where, params, desde, hasta, startField, endField) {
  if (desde && hasta) {
    where.push(`${startField} <= ? AND ${endField} >= ?`);
    params.push(hasta, desde);
    return;
  }

  if (desde) {
    where.push(`${endField} >= ?`);
    params.push(desde);
  }

  if (hasta) {
    where.push(`${startField} <= ?`);
    params.push(hasta);
  }
}

function validateRange(startDate, endDate) {
  if (!startDate || !endDate) return "Missing start_date/end_date";
  if (!isDateOnly(startDate) || !isDateOnly(endDate)) return "Invalid date format, expected YYYY-MM-DD";
  if (endDate < startDate) return "end_date cannot be less than start_date";
  return null;
}

// ===============================
// VACATIONS
// ===============================

// GET /api/vacations?userCode=&desde=&hasta=
router.get("/vacations", async (req, res) => {
  try {
    const { userCode, desde, hasta } = req.query;
    const where = [];
    const params = [];

    if (userCode) {
      where.push("user_code = ?");
      params.push(String(userCode));
    }

    applyRangeFilters(where, params, desde, hasta, "start_date", "end_date");

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await pool.query(
      `
      SELECT
        id,
        user_code AS userCode,
        user_name AS userName,
        start_date AS startDate,
        end_date AS endDate,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM vacations
      ${whereSql}
      ORDER BY start_date DESC, user_name ASC
      `,
      params
    );

    res.json(rows);
  } catch (error) {
    console.error("GET /api/vacations error:", error);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

// POST /api/vacations
router.post("/vacations", requireRole("admin", "rrhh"), async (req, res) => {
  try {
    const { userCode, userName, startDate, endDate } = req.body || {};

    if (!userCode || !userName) {
      return res.status(400).json({ ok: false, error: "Missing userCode/userName" });
    }

    const rangeError = validateRange(startDate, endDate);
    if (rangeError) {
      return res.status(400).json({ ok: false, error: rangeError });
    }

    const [result] = await pool.query(
      `
      INSERT INTO vacations (user_code, user_name, start_date, end_date)
      VALUES (?, ?, ?, ?)
      `,
      [String(userCode), String(userName), startDate, endDate]
    );

    res.json({ ok: true, id: result.insertId });
  } catch (error) {
    console.error("POST /api/vacations error:", error);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

// DELETE /api/vacations/:id
router.delete("/vacations/:id", requireRole("admin", "rrhh"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid id" });

    const [result] = await pool.query(`DELETE FROM vacations WHERE id = ?`, [id]);

    if (!result.affectedRows) {
      return res.status(404).json({ ok: false, error: "Vacation not found" });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/vacations/:id error:", error);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

// ===============================
// HOLIDAYS
// ===============================

// GET /api/holidays?desde=&hasta=
router.get("/holidays", async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const where = [];
    const params = [];

    if (desde) {
      where.push("holiday_date >= ?");
      params.push(desde);
    }

    if (hasta) {
      where.push("holiday_date <= ?");
      params.push(hasta);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await pool.query(
      `
      SELECT
        id,
        holiday_date AS holidayDate,
        description,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM holidays
      ${whereSql}
      ORDER BY holiday_date DESC
      `,
      params
    );

    res.json(rows);
  } catch (error) {
    console.error("GET /api/holidays error:", error);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

// POST /api/holidays
router.post("/holidays", requireRole("admin", "rrhh"), async (req, res) => {
  try {
    const { holidayDate, description } = req.body || {};

    if (!holidayDate || !description) {
      return res.status(400).json({ ok: false, error: "Missing holidayDate/description" });
    }

    if (!isDateOnly(holidayDate)) {
      return res.status(400).json({ ok: false, error: "Invalid holidayDate, expected YYYY-MM-DD" });
    }

    const [result] = await pool.query(
      `
      INSERT INTO holidays (holiday_date, description)
      VALUES (?, ?)
      `,
      [holidayDate, String(description)]
    );

    res.json({ ok: true, id: result.insertId });
  } catch (error) {
    if (error && error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ ok: false, error: "Holiday already exists for that date" });
    }

    console.error("POST /api/holidays error:", error);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

// DELETE /api/holidays/:id
router.delete("/holidays/:id", requireRole("admin", "rrhh"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid id" });

    const [result] = await pool.query(`DELETE FROM holidays WHERE id = ?`, [id]);

    if (!result.affectedRows) {
      return res.status(404).json({ ok: false, error: "Holiday not found" });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/holidays/:id error:", error);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

// ===============================
// LEAVES / LICENSES
// ===============================

// GET /api/leaves?userCode=&desde=&hasta=
router.get("/leaves", async (req, res) => {
  try {
    const { userCode, desde, hasta } = req.query;
    const where = [];
    const params = [];

    if (userCode) {
      where.push("user_code = ?");
      params.push(String(userCode));
    }

    applyRangeFilters(where, params, desde, hasta, "start_date", "end_date");

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await pool.query(
      `
      SELECT
        id,
        user_code AS userCode,
        user_name AS userName,
        reason,
        start_date AS startDate,
        end_date AS endDate,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM leaves_absences
      ${whereSql}
      ORDER BY start_date DESC, user_name ASC
      `,
      params
    );

    res.json(rows);
  } catch (error) {
    console.error("GET /api/leaves error:", error);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

// POST /api/leaves
router.post("/leaves", requireRole("admin", "rrhh"), async (req, res) => {
  try {
    const { userCode, userName, reason, startDate, endDate } = req.body || {};

    if (!userCode || !userName || !reason) {
      return res.status(400).json({ ok: false, error: "Missing userCode/userName/reason" });
    }

    const rangeError = validateRange(startDate, endDate);
    if (rangeError) {
      return res.status(400).json({ ok: false, error: rangeError });
    }

    const [result] = await pool.query(
      `
      INSERT INTO leaves_absences (user_code, user_name, reason, start_date, end_date)
      VALUES (?, ?, ?, ?, ?)
      `,
      [String(userCode), String(userName), String(reason), startDate, endDate]
    );

    res.json({ ok: true, id: result.insertId });
  } catch (error) {
    console.error("POST /api/leaves error:", error);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

// DELETE /api/leaves/:id
router.delete("/leaves/:id", requireRole("admin", "rrhh"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "Invalid id" });

    const [result] = await pool.query(`DELETE FROM leaves_absences WHERE id = ?`, [id]);

    if (!result.affectedRows) {
      return res.status(404).json({ ok: false, error: "Leave not found" });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/leaves/:id error:", error);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

// ===============================
// BACKEND LOGIC HELPER
// GET /api/calendar-exceptions?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&userCode=70
// Devuelve feriados + vacaciones + licencias día por día
// ===============================
router.get("/calendar-exceptions", async (req, res) => {
  try {
    const { desde, hasta, userCode } = req.query;

    if (!desde || !hasta) {
      return res.status(400).json({ ok: false, error: "Missing desde/hasta" });
    }

    if (!isDateOnly(desde) || !isDateOnly(hasta)) {
      return res.status(400).json({ ok: false, error: "Invalid date format, expected YYYY-MM-DD" });
    }

    if (hasta < desde) {
      return res.status(400).json({ ok: false, error: "hasta cannot be less than desde" });
    }

    const [holidayRows] = await pool.query(
      `
      SELECT holiday_date AS holidayDate, description
      FROM holidays
      WHERE holiday_date >= ? AND holiday_date <= ?
      ORDER BY holiday_date ASC
      `,
      [desde, hasta]
    );

    let vacationRows = [];
    let leaveRows = [];

    if (userCode) {
      const [vacRows] = await pool.query(
        `
        SELECT user_code AS userCode, user_name AS userName, start_date AS startDate, end_date AS endDate
        FROM vacations
        WHERE user_code = ?
          AND start_date <= ?
          AND end_date >= ?
        ORDER BY start_date ASC
        `,
        [String(userCode), hasta, desde]
      );

      const [leaRows] = await pool.query(
        `
        SELECT user_code AS userCode, user_name AS userName, reason, start_date AS startDate, end_date AS endDate
        FROM leaves_absences
        WHERE user_code = ?
          AND start_date <= ?
          AND end_date >= ?
        ORDER BY start_date ASC
        `,
        [String(userCode), hasta, desde]
      );

      vacationRows = vacRows;
      leaveRows = leaRows;
    }

    const daysMap = new Map();

    for (const date of expandDateRange(desde, hasta)) {
      daysMap.set(date, {
        date,
        isHoliday: false,
        holidayDescription: null,
        onVacation: false,
        vacationUserCode: null,
        vacationUserName: null,
        onLeave: false,
        leaveReason: null,
        leaveUserCode: null,
        leaveUserName: null,
      });
    }

    for (const h of holidayRows) {
      if (!daysMap.has(h.holidayDate)) continue;
      const item = daysMap.get(h.holidayDate);
      item.isHoliday = true;
      item.holidayDescription = h.description;
    }

    for (const v of vacationRows) {
      for (const date of expandDateRange(v.startDate, v.endDate)) {
        if (!daysMap.has(date)) continue;
        const item = daysMap.get(date);
        item.onVacation = true;
        item.vacationUserCode = v.userCode;
        item.vacationUserName = v.userName;
      }
    }

    for (const l of leaveRows) {
      for (const date of expandDateRange(l.startDate, l.endDate)) {
        if (!daysMap.has(date)) continue;
        const item = daysMap.get(date);
        item.onLeave = true;
        item.leaveReason = l.reason;
        item.leaveUserCode = l.userCode;
        item.leaveUserName = l.userName;
      }
    }

    res.json({
      ok: true,
      desde,
      hasta,
      userCode: userCode || null,
      days: [...daysMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
    });
  } catch (error) {
    console.error("GET /api/calendar-exceptions error:", error);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

module.exports = router;