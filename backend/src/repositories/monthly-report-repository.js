const { QueryTypes } = require('sequelize');
const models = require('../models');

const sequelize = models.sequelize;
const DAY_MS = 86400000;

const AVAILABLE_MONTHS = [
  { mes: '2026-10', etiqueta: 'Octubre 2026', fecha_inicio: '2026-10-01', fecha_fin: '2026-10-31' },
  { mes: '2026-09', etiqueta: 'Septiembre 2026', fecha_inicio: '2026-09-01', fecha_fin: '2026-09-30' },
  { mes: '2026-08', etiqueta: 'Agosto 2026', fecha_inicio: '2026-08-01', fecha_fin: '2026-08-31' },
];

const DEFAULT_MONTH = AVAILABLE_MONTHS[0].mes;

function asDate(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function addDays(dateStr, days) {
  return new Date(Date.parse(`${dateStr}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function overlapDays(startA, endA, startB, endB) {
  const start = startA > startB ? startA : startB;
  const end = endA < endB ? endA : endB;
  if (end < start) return 0;
  return Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS) + 1;
}

function findMonth(mes) {
  return AVAILABLE_MONTHS.find((item) => item.mes === mes) || null;
}

function listAvailableMonths() {
  return AVAILABLE_MONTHS.map((item) => ({ ...item }));
}

async function select(sql, replacements = {}) {
  return sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
}

async function getMonthlyReport(mes) {
  const period = findMonth(mes);
  if (!period) return null;
  const params = { start: period.fecha_inicio, end: period.fecha_fin };

  const [attendanceRows, requestRows, incapacityRows, movementRows] = await Promise.all([
    select(`
      SELECT
        COUNT(DISTINCT colaborador_id) AS colaboradores_con_registro,
        SUM(es_dia_programado = 1) AS dias_programados,
        SUM(estado IN ('puntual', 'tardia')) AS dias_trabajados,
        SUM(estado = 'puntual') AS dias_puntuales,
        SUM(estado = 'tardia') AS tardias,
        COALESCE(SUM(CASE WHEN estado = 'tardia' THEN minutos_tardia ELSE 0 END), 0) AS minutos_tardia_total,
        SUM(estado = 'falta') AS faltas,
        SUM(estado = 'vacaciones') AS dias_vacaciones,
        SUM(estado = 'permiso') AS dias_permiso,
        SUM(estado = 'incapacidad') AS dias_incapacidad,
        SUM(estado = 'dia_libre') AS dias_libres,
        SUM(estado = 'sin_registro') AS sin_registro
      FROM asistencias
      WHERE fecha >= :start AND fecha <= :end
    `, params),
    select(`
      SELECT id, colaborador_id, tipo, fecha_inicio, fecha_fin, estado
      FROM solicitudes
      WHERE fecha_inicio <= :end AND fecha_fin >= :start
    `, params),
    select(`
      SELECT id, colaborador_id, tipo, fecha_inicio, dias
      FROM incapacidades
      WHERE fecha_inicio <= :end AND DATE_ADD(fecha_inicio, INTERVAL dias - 1 DAY) >= :start
    `, params),
    select(`
      SELECT m.id, m.colaborador_id, COALESCE(u.nombres, c.nombre) AS nombre, c.departamento, m.tipo, m.fecha, m.motivo AS detalle
      FROM movimientos_personal m
      JOIN colaboradores c ON c.id = m.colaborador_id
      LEFT JOIN usuarios u ON u.colaborador_id = c.id
      WHERE m.fecha >= :start AND m.fecha <= :end
      ORDER BY m.fecha DESC, m.id DESC
    `, params),
  ]);

  const att = attendanceRows[0] || {};
  const diasProgramados = Number(att.dias_programados || 0);
  const diasTrabajados = Number(att.dias_trabajados || 0);
  const diasPuntuales = Number(att.dias_puntuales || 0);
  const tardias = Number(att.tardias || 0);
  const minutosTardiaTotal = Number(att.minutos_tardia_total || 0);
  const faltas = Number(att.faltas || 0);
  const diasVacaciones = Number(att.dias_vacaciones || 0);
  const diasPermiso = Number(att.dias_permiso || 0);
  const diasIncapacidad = Number(att.dias_incapacidad || 0);
  const diasLibres = Number(att.dias_libres || 0);
  const sinRegistro = Number(att.sin_registro || 0);
  const ausenciasJustificadasTotal = diasVacaciones + diasPermiso + diasIncapacidad;

  const porEstado = { aprobada: 0, pendiente: 0, rechazada: 0 };
  const porTipo = { vacaciones: 0, permiso: 0 };
  let diasSolicitadosEnMes = 0;
  for (const row of requestRows) {
    if (Object.hasOwn(porEstado, row.estado)) porEstado[row.estado] += 1;
    if (Object.hasOwn(porTipo, row.tipo)) porTipo[row.tipo] += 1;
    diasSolicitadosEnMes += overlapDays(asDate(row.fecha_inicio), asDate(row.fecha_fin), period.fecha_inicio, period.fecha_fin);
  }

  let diasIncapacidadEnMes = 0;
  for (const row of incapacityRows) {
    const start = asDate(row.fecha_inicio);
    const end = addDays(start, Number(row.dias) - 1);
    diasIncapacidadEnMes += overlapDays(start, end, period.fecha_inicio, period.fecha_fin);
  }

  let ingresos = 0;
  let salidas = 0;
  let ascensos = 0;
  const movementItems = movementRows.map((row) => {
    if (row.tipo === 'ingreso') ingresos += 1;
    else if (row.tipo === 'salida') salidas += 1;
    else if (row.tipo === 'ascenso') ascensos += 1;
    return {
      id: Number(row.id),
      colaborador_id: Number(row.colaborador_id),
      nombre: row.nombre,
      departamento: row.departamento,
      tipo: row.tipo,
      fecha: asDate(row.fecha),
      detalle: row.detalle || null,
    };
  });

  return {
    mes: period.mes,
    etiqueta: period.etiqueta,
    fecha_inicio: period.fecha_inicio,
    fecha_fin: period.fecha_fin,
    zona_horaria: 'America/Costa_Rica',
    origen_datos: 'simulado',
    colaboradores_con_registro: Number(att.colaboradores_con_registro || 0),
    asistencia: {
      dias_programados: diasProgramados,
      dias_trabajados: diasTrabajados,
      dias_puntuales: diasPuntuales,
      tardias,
      minutos_tardia_total: minutosTardiaTotal,
      promedio_minutos_tardia: tardias > 0 ? Number((minutosTardiaTotal / tardias).toFixed(1)) : 0,
      faltas,
      ausencias_justificadas: {
        total: ausenciasJustificadasTotal,
        vacaciones: diasVacaciones,
        permiso: diasPermiso,
        incapacidad: diasIncapacidad,
      },
      dias_libres: diasLibres,
      sin_registro: sinRegistro,
      porcentaje_asistencia: diasProgramados > 0 ? Number(((diasTrabajados / diasProgramados) * 100).toFixed(2)) : null,
      formula_porcentaje_asistencia: 'dias_trabajados / dias_programados * 100 (las tardías cuentan como días trabajados)',
      porcentaje_puntualidad: diasTrabajados > 0 ? Number(((diasPuntuales / diasTrabajados) * 100).toFixed(2)) : null,
      formula_porcentaje_puntualidad: 'dias_puntuales / dias_trabajados * 100',
    },
    solicitudes: {
      total: requestRows.length,
      por_estado: porEstado,
      por_tipo: porTipo,
      dias_solicitados_en_mes: diasSolicitadosEnMes,
      nota_conteo: 'Cada solicitud cuenta una vez en el total aunque abarque varios días; dias_solicitados_en_mes suma los días naturales que caen dentro del mes.',
    },
    incapacidades: {
      total_registros: incapacityRows.length,
      dias_en_mes: diasIncapacidadEnMes,
      nota_conteo: 'total_registros cuenta certificados de incapacidad que se solapan con el mes; dias_en_mes cuenta únicamente los días comprendidos dentro del mes.',
    },
    movimientos_personal: {
      total: movementItems.length,
      ingresos,
      salidas,
      ascensos,
      items: movementItems,
    },
  };
}

async function getCollaboratorProfile(colaboradorId, mes = DEFAULT_MONTH) {
  const period = findMonth(mes);
  if (!period) return { invalidMonth: true };

  const [personRows, exitRows] = await Promise.all([
    select(`
      SELECT c.id, COALESCE(u.nombres, c.nombre) AS nombre, c.departamento, c.puesto, c.estado, c.fecha_ingreso
      FROM colaboradores c
      LEFT JOIN usuarios u ON u.colaborador_id = c.id
      WHERE c.id = :id
      LIMIT 1
    `, { id: colaboradorId }),
    select(`
      SELECT MIN(fecha) AS fecha_salida
      FROM movimientos_personal
      WHERE colaborador_id = :id AND tipo = 'salida'
    `, { id: colaboradorId }),
  ]);

  const person = personRows[0];
  if (!person) return null;

  const fechaIngreso = asDate(person.fecha_ingreso);
  const fechaSalida = asDate(exitRows[0]?.fecha_salida);
  const params = { id: colaboradorId, start: period.fecha_inicio, end: period.fecha_fin };

  const [attendanceRows, requestRows, incapacityRows, movementRows] = await Promise.all([
    select(`
      SELECT fecha, es_dia_programado, hora_entrada_programada, hora_entrada_real, minutos_tardia, estado, origen
      FROM asistencias
      WHERE colaborador_id = :id AND fecha >= :start AND fecha <= :end
      ORDER BY fecha ASC
    `, params),
    select(`
      SELECT id, tipo, fecha_inicio, fecha_fin, estado
      FROM solicitudes
      WHERE colaborador_id = :id AND fecha_inicio <= :end AND fecha_fin >= :start
      ORDER BY fecha_inicio ASC, id ASC
    `, params),
    select(`
      SELECT id, tipo, fecha_inicio, dias
      FROM incapacidades
      WHERE colaborador_id = :id AND fecha_inicio <= :end AND DATE_ADD(fecha_inicio, INTERVAL dias - 1 DAY) >= :start
      ORDER BY fecha_inicio ASC, id ASC
    `, params),
    select(`
      SELECT id, tipo, fecha, motivo AS detalle
      FROM movimientos_personal
      WHERE colaborador_id = :id AND fecha >= :start AND fecha <= :end
      ORDER BY fecha ASC, id ASC
    `, params),
  ]);

  const byDate = new Map(attendanceRows.map((row) => [asDate(row.fecha), row]));
  const registroDiario = [];
  const resumen = {
    dias_programados: 0,
    dias_trabajados: 0,
    dias_puntuales: 0,
    tardias: 0,
    minutos_tardia_total: 0,
    faltas: 0,
    ausencias_justificadas: { total: 0, vacaciones: 0, permiso: 0, incapacidad: 0 },
    dias_libres: 0,
    sin_registro: 0,
  };

  for (let d = period.fecha_inicio; d <= period.fecha_fin; d = addDays(d, 1)) {
    if (d < fechaIngreso) continue;
    if (fechaSalida && d > fechaSalida) continue;
    const saved = byDate.get(d);
    let entry;
    if (saved) {
      entry = {
        fecha: d,
        es_dia_programado: Boolean(Number(saved.es_dia_programado)),
        estado: saved.estado,
        hora_entrada_programada: saved.hora_entrada_programada || null,
        hora_entrada_real: saved.hora_entrada_real || null,
        minutos_tardia: Number(saved.minutos_tardia || 0),
        origen: saved.origen,
      };
    } else {
      const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
      const weekday = dow !== 0 && dow !== 6;
      entry = {
        fecha: d,
        es_dia_programado: weekday,
        estado: 'sin_registro',
        hora_entrada_programada: weekday ? '08:00:00' : null,
        hora_entrada_real: null,
        minutos_tardia: 0,
        origen: null,
      };
    }
    registroDiario.push(entry);

    if (entry.es_dia_programado) resumen.dias_programados += 1;
    if (entry.estado === 'puntual') {
      resumen.dias_trabajados += 1;
      resumen.dias_puntuales += 1;
    } else if (entry.estado === 'tardia') {
      resumen.dias_trabajados += 1;
      resumen.tardias += 1;
      resumen.minutos_tardia_total += entry.minutos_tardia;
    } else if (entry.estado === 'falta') {
      resumen.faltas += 1;
    } else if (entry.estado === 'vacaciones') {
      resumen.ausencias_justificadas.vacaciones += 1;
      resumen.ausencias_justificadas.total += 1;
    } else if (entry.estado === 'permiso') {
      resumen.ausencias_justificadas.permiso += 1;
      resumen.ausencias_justificadas.total += 1;
    } else if (entry.estado === 'incapacidad') {
      resumen.ausencias_justificadas.incapacidad += 1;
      resumen.ausencias_justificadas.total += 1;
    } else if (entry.estado === 'dia_libre') {
      resumen.dias_libres += 1;
    } else {
      resumen.sin_registro += 1;
    }
  }

  return {
    colaborador: {
      id: Number(person.id),
      nombre: person.nombre,
      departamento: person.departamento,
      puesto: person.puesto,
      estado: person.estado,
      fecha_ingreso: fechaIngreso,
      fecha_salida: fechaSalida,
    },
    meses_disponibles: listAvailableMonths(),
    periodo: {
      mes: period.mes,
      etiqueta: period.etiqueta,
      fecha_inicio: period.fecha_inicio,
      fecha_fin: period.fecha_fin,
      zona_horaria: 'America/Costa_Rica',
    },
    resumen,
    registro_diario: registroDiario,
    solicitudes: requestRows.map((row) => ({
      id: Number(row.id),
      tipo: row.tipo,
      fecha_inicio: asDate(row.fecha_inicio),
      fecha_fin: asDate(row.fecha_fin),
      estado: row.estado,
      dias_en_periodo: overlapDays(asDate(row.fecha_inicio), asDate(row.fecha_fin), period.fecha_inicio, period.fecha_fin),
    })),
    incapacidades: incapacityRows.map((row) => {
      const start = asDate(row.fecha_inicio);
      const end = addDays(start, Number(row.dias) - 1);
      return {
        id: Number(row.id),
        tipo: row.tipo,
        fecha_inicio: start,
        dias: Number(row.dias),
        dias_en_periodo: overlapDays(start, end, period.fecha_inicio, period.fecha_fin),
      };
    }),
    movimientos_personal: movementRows.map((row) => ({
      id: Number(row.id),
      tipo: row.tipo,
      fecha: asDate(row.fecha),
      detalle: row.detalle || null,
    })),
  };
}

module.exports = {
  AVAILABLE_MONTHS,
  DEFAULT_MONTH,
  listAvailableMonths,
  findMonth,
  getMonthlyReport,
  getCollaboratorProfile,
  overlapDays,
};
