'use strict';
const { QueryTypes } = require('sequelize');

const PERIOD_START = '2026-08-01';
const PERIOD_END = '2026-10-31';
const DAY_MS = 86400000;
const CR_HOLIDAYS = new Set(['2026-08-02', '2026-08-15', '2026-09-15']);

function toDateString(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function addDays(dateStr, days) {
  return new Date(Date.parse(`${dateStr}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function weekdayUtc(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay(); // 0=Dom, 6=Sab
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function hashSeed(colaboradorId, dayIndex) {
  return ((colaboradorId * 37) + (dayIndex * 17) + (colaboradorId % 13) * 7) % 100;
}

module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const [collaborators, exits, requests, incapacities] = await Promise.all([
      sequelize.query('SELECT id, fecha_ingreso FROM colaboradores ORDER BY id ASC', { type: QueryTypes.SELECT }),
      sequelize.query("SELECT colaborador_id, MIN(fecha) AS fecha_salida FROM movimientos_personal WHERE tipo = 'salida' GROUP BY colaborador_id", { type: QueryTypes.SELECT }),
      sequelize.query("SELECT colaborador_id, tipo, fecha_inicio, fecha_fin FROM solicitudes WHERE estado = 'aprobada' AND fecha_inicio <= :end AND fecha_fin >= :start", {
        replacements: { start: PERIOD_START, end: PERIOD_END }, type: QueryTypes.SELECT,
      }),
      sequelize.query('SELECT colaborador_id, fecha_inicio, dias FROM incapacidades WHERE fecha_inicio <= :end AND DATE_ADD(fecha_inicio, INTERVAL dias - 1 DAY) >= :start', {
        replacements: { start: PERIOD_START, end: PERIOD_END }, type: QueryTypes.SELECT,
      }),
    ]);

    const exitByColab = new Map(exits.map((row) => [Number(row.colaborador_id), toDateString(row.fecha_salida)]));
    const reqByColab = new Map();
    for (const row of requests) {
      const id = Number(row.colaborador_id);
      if (!reqByColab.has(id)) reqByColab.set(id, []);
      reqByColab.get(id).push({ tipo: row.tipo, inicio: toDateString(row.fecha_inicio), fin: toDateString(row.fecha_fin) });
    }
    const incByColab = new Map();
    for (const row of incapacities) {
      const id = Number(row.colaborador_id);
      if (!incByColab.has(id)) incByColab.set(id, []);
      const inicio = toDateString(row.fecha_inicio);
      incByColab.get(id).push({ inicio, fin: addDays(inicio, Number(row.dias) - 1) });
    }

    const dates = [];
    for (let d = PERIOD_START; d <= PERIOD_END; d = addDays(d, 1)) dates.push(d);

    const rows = [];
    for (const person of collaborators) {
      const id = Number(person.id);
      const hired = toDateString(person.fecha_ingreso);
      const exitDate = exitByColab.get(id) || null;
      const personReqs = reqByColab.get(id) || [];
      const personIncs = incByColab.get(id) || [];

      for (let dayIndex = 0; dayIndex < dates.length; dayIndex += 1) {
        const fecha = dates[dayIndex];
        if (fecha < hired) continue;
        if (exitDate && fecha > exitDate) continue;

        const dow = weekdayUtc(fecha);
        const isWeekend = dow === 0 || dow === 6;
        const isHoliday = CR_HOLIDAYS.has(fecha);

        if (isWeekend || isHoliday) {
          rows.push([id, fecha, 0, null, null, 0, 'dia_libre', 'simulado']);
          continue;
        }

        const hasInc = personIncs.some((item) => fecha >= item.inicio && fecha <= item.fin);
        if (hasInc) {
          rows.push([id, fecha, 1, '08:00:00', null, 0, 'incapacidad', 'simulado']);
          continue;
        }

        const req = personReqs.find((item) => fecha >= item.inicio && fecha <= item.fin);
        if (req) {
          rows.push([id, fecha, 1, '08:00:00', null, 0, req.tipo === 'vacaciones' ? 'vacaciones' : 'permiso', 'simulado']);
          continue;
        }

        const bucket = hashSeed(id, dayIndex);
        if (bucket === 0) {
          rows.push([id, fecha, 1, '08:00:00', null, 0, 'sin_registro', 'simulado']);
        } else if (bucket <= 2) {
          rows.push([id, fecha, 1, '08:00:00', null, 0, 'falta', 'simulado']);
        } else if (bucket <= 11) {
          const lateMinutes = 6 + ((id + dayIndex * 3) % 28);
          rows.push([id, fecha, 1, '08:00:00', `08:${pad2(lateMinutes)}:00`, lateMinutes, 'tardia', 'simulado']);
        } else {
          const earlyMinutes = 54 + ((id + dayIndex) % 7); // 07:54..08:00
          const realTime = earlyMinutes === 60 ? '08:00:00' : `07:${pad2(earlyMinutes)}:00`;
          rows.push([id, fecha, 1, '08:00:00', realTime, 0, 'puntual', 'simulado']);
        }
      }
    }

    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      await sequelize.query(
        `INSERT IGNORE INTO asistencias (colaborador_id, fecha, es_dia_programado, hora_entrada_programada, hora_entrada_real, minutos_tardia, estado, origen) VALUES ${placeholders}`,
        { replacements: chunk.flat() },
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      "DELETE FROM asistencias WHERE origen = 'simulado' AND fecha >= :start AND fecha <= :end",
      { replacements: { start: PERIOD_START, end: PERIOD_END } },
    );
  },
};
