const { DateTime } = require("luxon");

const ARG_TZ = process.env.ARG_TZ || "America/Argentina/Buenos_Aires";

// ISO con Z -> MySQL DATETIME(3) UTC
function isoToMysqlUtc(iso) {
  const dt = DateTime.fromISO(iso, { setZone: true });
  if (!dt.isValid) return null;
  // Guardamos en UTC sin "Z"
  return dt.toUTC().toFormat("yyyy-LL-dd HH:mm:ss.SSS");
}

function mysqlUtcToArgentina(mysqlUtc) {
  // mysqlUtc viene como Date o string
  const dt = DateTime.fromJSDate(new Date(mysqlUtc), { zone: "utc" });
  return dt.setZone(ARG_TZ).toISO({ suppressMilliseconds: false });
}

module.exports = { isoToMysqlUtc, mysqlUtcToArgentina, ARG_TZ };
