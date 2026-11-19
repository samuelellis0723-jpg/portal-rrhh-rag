const { QueryTypes } = require('sequelize');
const models = require('../models');
const sequelize = models.sequelize;

const CR_OFFSET = '-06:00';
const asDate = (value) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
const asUtcInstant = (value) => {
  if (value instanceof Date) return value;
  const text = String(value);
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(text) ? text : `${text.replace(' ', 'T')}Z`);
};

function dateBefore(date, days) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

function dateRange(date) {
  const monthStart = `${date.slice(0, 7)}-01`;
  const yesterday = dateBefore(date, 1);
  return {
    date,
    monthStart,
    cutoffUtc: `${date} 13:00:00`,
    yesterdayStartUtc: `${yesterday} 06:00:00`,
    dateStartUtc: `${date} 06:00:00`,
  };
}

async function select(sql, replacements = {}) {
  return sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
}

async function rosterAt(date) {
  const [row] = await select(`
    SELECT COUNT(*) AS headcount,
      SUM(CASE WHEN c.estado = 'inactivo' AND exits.fecha_salida IS NULL THEN 1 ELSE 0 END) AS unknown_count
    FROM colaboradores c
    LEFT JOIN (
      SELECT colaborador_id, MIN(fecha) AS fecha_salida
      FROM movimientos_personal WHERE tipo = 'salida' GROUP BY colaborador_id
    ) exits ON exits.colaborador_id = c.id
    WHERE c.fecha_ingreso <= :date
      AND (exits.fecha_salida IS NULL OR exits.fecha_salida > :date)
  `, { date });
  return { count: Number(row.headcount || 0), unknown: Number(row.unknown_count || 0) > 0 };
}

// La suma incluye conversaciones borradas sin volver a almacenar su contenido o identidad.
const chatMetricsSql = `
  SELECT DATE_FORMAT(DATE_SUB(creada_en, INTERVAL 6 HOUR), '%Y-%m-%d') AS fecha,
    COALESCE(tema, '') AS tema, COUNT(*) AS consultas,
    SUM(resuelta = 1 AND escalada = 0) AS resueltas, SUM(resuelta = 0) AS sin_respuesta,
    COALESCE(SUM(latencia_ms), 0) AS latencia_total, COUNT(latencia_ms) AS latencia_count
  FROM consultas_chat GROUP BY DATE_FORMAT(DATE_SUB(creada_en, INTERVAL 6 HOUR), '%Y-%m-%d'), COALESCE(tema, '')
  UNION ALL SELECT fecha, tema, consultas, resueltas, sin_respuesta, latencia_total, latencia_count FROM chat_metricas_eliminadas
`;

async function aggregateReport(date) {
  const range = dateRange(date);
  const [absenceRows, pendingRows, activeIncapacityRows, daysRows, movementRows, initialRoster, cutoffRoster,
    riskRows, chatbotRows, trendRows, topicRows, unresolvedRows, unknownRoster, peopleRows] = await Promise.all([
    select(`
      SELECT DISTINCT source.colaborador_id, source.departamento, source.tipo
      FROM (
        SELECT c.id AS colaborador_id, c.departamento, s.tipo
        FROM solicitudes s JOIN colaboradores c ON c.id = s.colaborador_id
        WHERE s.estado = 'aprobada' AND s.resuelta_en IS NOT NULL AND s.resuelta_en <= :cutoffUtc
          AND s.fecha_inicio <= :date AND s.fecha_fin >= :date AND c.fecha_ingreso <= :date
          AND NOT EXISTS (SELECT 1 FROM movimientos_personal m WHERE m.colaborador_id = c.id AND m.tipo = 'salida' AND m.fecha <= :date)
        UNION ALL
        SELECT c.id AS colaborador_id, c.departamento, 'incapacidad' AS tipo
        FROM incapacidades i JOIN colaboradores c ON c.id = i.colaborador_id
        WHERE i.registrada_en <= :cutoffUtc AND i.fecha_inicio <= :date AND DATE_ADD(i.fecha_inicio, INTERVAL (i.dias - 1) DAY) >= :date
          AND c.fecha_ingreso <= :date
          AND NOT EXISTS (SELECT 1 FROM movimientos_personal m WHERE m.colaborador_id = c.id AND m.tipo = 'salida' AND m.fecha <= :date)
      ) source
    `, range),
    select(`
      SELECT s.id, s.colaborador_id, COALESCE(u.nombres, c.nombre) AS nombre, s.tipo, c.departamento, s.fecha_inicio, s.fecha_fin, s.creada_en
      FROM solicitudes s JOIN colaboradores c ON c.id = s.colaborador_id
      LEFT JOIN usuarios u ON u.colaborador_id = c.id
      WHERE s.creada_en <= :cutoffUtc
        AND ((s.estado = 'pendiente' AND (s.resuelta_en IS NULL OR s.resuelta_en > :cutoffUtc)) OR s.resuelta_en > :cutoffUtc)
      ORDER BY s.creada_en ASC, s.id ASC
    `, range),
    select(`
      SELECT COUNT(*) AS total FROM incapacidades i
      WHERE i.registrada_en <= :cutoffUtc AND i.fecha_inicio <= :date AND DATE_ADD(i.fecha_inicio, INTERVAL (i.dias - 1) DAY) >= :date
    `, range),
    select(`
      SELECT COALESCE(SUM(GREATEST(0, DATEDIFF(
        LEAST(DATE_ADD(i.fecha_inicio, INTERVAL (i.dias - 1) DAY), :date),
        GREATEST(i.fecha_inicio, :monthStart)
      ) + 1)), 0) AS total
      FROM incapacidades i
      WHERE i.registrada_en <= :cutoffUtc AND i.fecha_inicio <= :date AND DATE_ADD(i.fecha_inicio, INTERVAL (i.dias - 1) DAY) >= :monthStart
    `, range),
    select(`
      SELECT
        SUM(CASE WHEN tipo = 'ingreso' THEN 1 ELSE 0 END) AS ingresos_mes,
        SUM(CASE WHEN tipo = 'salida' THEN 1 ELSE 0 END) AS salidas_mes
      FROM movimientos_personal WHERE fecha >= :monthStart AND fecha <= :date
    `, range),
    rosterAt(range.monthStart), rosterAt(date),
    select(`
      SELECT c.id AS colaborador_id, COALESCE(u.nombres, c.nombre) AS nombre, c.departamento, CAST(SUM(v.dias_disponibles) AS CHAR) AS dias_disponibles
      FROM saldos_vacaciones v JOIN colaboradores c ON c.id = v.colaborador_id
      LEFT JOIN usuarios u ON u.colaborador_id = c.id
      WHERE c.fecha_ingreso <= :date
        AND NOT EXISTS (SELECT 1 FROM movimientos_personal m WHERE m.colaborador_id = c.id AND m.tipo = 'salida' AND m.fecha <= :date)
      GROUP BY c.id, u.nombres, c.nombre, c.departamento HAVING SUM(v.dias_disponibles) > 20
      ORDER BY SUM(v.dias_disponibles) DESC, c.id ASC
    `, range),
    select(`
      SELECT SUM(consultas) AS total, SUM(resueltas) AS resueltas_sin_escalar,
        SUM(latencia_total) / NULLIF(SUM(latencia_count), 0) AS latencia_promedio_ms
      FROM (${chatMetricsSql}) metrics WHERE fecha = :yesterday
    `, { ...range, yesterday: dateBefore(date, 1) }),
    select(`
      SELECT fecha, SUM(consultas) AS consultas FROM (${chatMetricsSql}) metrics
      WHERE fecha >= :trendStart AND fecha < :date GROUP BY fecha
    `, { ...range, trendStart: dateBefore(date, 30) }),
    select(`
      SELECT tema, SUM(consultas) AS consultas FROM (${chatMetricsSql}) metrics
      WHERE fecha = :yesterday AND tema <> ''
      GROUP BY tema ORDER BY consultas DESC, tema ASC LIMIT 20
    `, { ...range, yesterday: dateBefore(date, 1) }),
    select(`
      SELECT tema, SUM(sin_respuesta) AS consultas FROM (${chatMetricsSql}) metrics
      WHERE fecha = :yesterday GROUP BY tema HAVING SUM(sin_respuesta) > 0
      ORDER BY consultas DESC, tema ASC LIMIT 20
    `, { ...range, yesterday: dateBefore(date, 1) }),
    select(`
      SELECT COUNT(*) AS total FROM colaboradores c
      WHERE c.fecha_ingreso <= :date AND c.estado = 'inactivo'
        AND NOT EXISTS (SELECT 1 FROM movimientos_personal m WHERE m.colaborador_id = c.id AND m.tipo = 'salida')
    `, range),
    select(`
      SELECT c.id AS colaborador_id, COALESCE(u.nombres, c.nombre) AS nombre, c.departamento, c.puesto, c.estado,
        CAST(COALESCE(vac.dias_disponibles, 0) AS CHAR) AS dias_vacaciones_disponibles,
        COALESCE(pend.total, 0) AS solicitudes_pendientes,
        COALESCE(inc.total, 0) AS incapacidades_activas
      FROM colaboradores c
      LEFT JOIN usuarios u ON u.colaborador_id = c.id
      LEFT JOIN (
        SELECT colaborador_id, SUM(dias_disponibles) AS dias_disponibles
        FROM saldos_vacaciones GROUP BY colaborador_id
      ) vac ON vac.colaborador_id = c.id
      LEFT JOIN (
        SELECT colaborador_id, COUNT(*) AS total
        FROM solicitudes
        WHERE creada_en <= :cutoffUtc
          AND ((estado = 'pendiente' AND (resuelta_en IS NULL OR resuelta_en > :cutoffUtc)) OR resuelta_en > :cutoffUtc)
        GROUP BY colaborador_id
      ) pend ON pend.colaborador_id = c.id
      LEFT JOIN (
        SELECT colaborador_id, COUNT(*) AS total
        FROM incapacidades
        WHERE registrada_en <= :cutoffUtc AND fecha_inicio <= :date AND DATE_ADD(fecha_inicio, INTERVAL (dias - 1) DAY) >= :date
        GROUP BY colaborador_id
      ) inc ON inc.colaborador_id = c.id
      WHERE c.fecha_ingreso <= :date
      ORDER BY nombre ASC, c.id ASC
    `, range),
  ]);

  const rosterKnown = Number(unknownRoster[0]?.total || 0) === 0;
  const cutoff = asUtcInstant(range.cutoffUtc).getTime();
  const pendingItems = pendingRows.map((row) => {
    const created = asUtcInstant(row.creada_en);
    const ageMs = cutoff - created.getTime();
    return {
      id: Number(row.id), nombre: row.nombre, tipo: row.tipo, departamento: row.departamento,
      fecha_inicio: asDate(row.fecha_inicio), fecha_fin: asDate(row.fecha_fin),
      creada_en: created.toISOString(), dias_pendiente: Math.max(0, Math.floor(ageMs / 86400000)),
      _ageMs: ageMs,
    };
  });
  const absentByPerson = new Map();
  for (const row of absenceRows) {
    if (!absentByPerson.has(Number(row.colaborador_id))) absentByPerson.set(Number(row.colaborador_id), row);
  }
  const types = ['vacaciones', 'permiso', 'incapacidad'];
  const byDept = new Map();
  for (const row of absenceRows) {
    const department = String(row.departamento || 'Sin departamento');
    if (!byDept.has(department)) byDept.set(department, { departamento: department, total: 0, por_tipo: Object.fromEntries(types.map((type) => [type, 0])), _people: new Set() });
    const item = byDept.get(department);
    item._people.add(Number(row.colaborador_id));
    if (types.includes(row.tipo)) item.por_tipo[row.tipo] += 1;
  }
  const absenceCounts = Object.fromEntries(types.map((type) => [type, new Set(absenceRows.filter((row) => row.tipo === type).map((row) => Number(row.colaborador_id))).size]));
  const departmentAbsences = [...byDept.values()].map((item) => {
    item.total = item._people.size;
    delete item._people;
    return item;
  }).sort((a, b) => a.departamento.localeCompare(b.departamento, 'es'));

  const trendCounts = new Map(trendRows.map((row) => [asDate(row.fecha), Number(row.consultas)]));
  const trend = Array.from({ length: 30 }, (_, index) => {
    const day = dateBefore(date, 30 - index);
    return { fecha: day, consultas: trendCounts.get(day) || 0 };
  });
  const chat = chatbotRows[0] || {};
  const chatTotal = Number(chat.total || 0);
  const topicNames = new Set(['vacaciones', 'permisos', 'incapacidades', 'pagos', 'evaluaciones', 'teletrabajo', 'beneficios', 'privacidad', 'conducta']);
  const topicLabel = (value) => topicNames.has(String(value || '').toLowerCase()) ? String(value).toLowerCase() : 'otros';
  const groupTopicRows = (rows) => {
    const grouped = new Map();
    for (const row of rows) {
      const name = topicLabel(row.tema);
      grouped.set(name, (grouped.get(name) || 0) + Number(row.consultas));
    }
    return [...grouped].map(([tema, consultas]) => ({ tema, consultas }))
      .sort((a, b) => b.consultas - a.consultas || a.tema.localeCompare(b.tema, 'es'));
  };
  const unresolved = groupTopicRows(unresolvedRows).map(({ tema, consultas }) => ({
    pregunta: `Consulta sin respuesta sobre ${tema}.`, consultas,
  }));
  const riskByDepartment = new Map();
  for (const row of riskRows) riskByDepartment.set(row.departamento, (riskByDepartment.get(row.departamento) || 0) + 1);
  const rosterStartKnown = !initialRoster.unknown;
  const rosterCutKnown = !cutoffRoster.unknown;
  const averageRoster = (initialRoster.count + cutoffRoster.count) / 2;
  const movement = movementRows[0] || {};
  const absencesAvailable = rosterKnown;
  const riskAvailable = rosterCutKnown;
  const movementAvailable = rosterStartKnown && rosterCutKnown;
  const report = {
    ausencias: {
      disponible: absencesAvailable,
      fecha: date,
      total: absencesAvailable ? absentByPerson.size : null,
      por_tipo: absencesAvailable ? absenceCounts : null,
      por_departamento: absencesAvailable ? departmentAbsences : null,
    },
    solicitudes_pendientes: {
      total: pendingItems.length,
      mas_de_3_dias: pendingItems.filter((row) => row._ageMs > 72 * 60 * 60 * 1000).length,
      items: pendingItems.map(({ _ageMs, ...item }) => item),
    },
    incapacidades: { activas: Number(activeIncapacityRows[0]?.total || 0), dias_acumulados_mes: Number(daysRows[0]?.total || 0) },
    movimientos_personal: {
      disponible: movementAvailable,
      ingresos_mes: Number(movement.ingresos_mes || 0), salidas_mes: Number(movement.salidas_mes || 0),
      rotacion_acumulada_pct: movementAvailable && averageRoster > 0
        ? Number((Number(movement.salidas_mes || 0) / averageRoster * 100).toFixed(2)) : null,
      dotacion_inicio_mes: rosterStartKnown ? initialRoster.count : null,
      dotacion_corte: rosterCutKnown ? cutoffRoster.count : null,
      formula: 'salidas_mes / ((dotacion_inicio_mes + dotacion_corte) / 2) * 100',
    },
    riesgo_vacaciones: {
      disponible: riskAvailable, umbral_dias: 20,
      total_colaboradores: riskAvailable ? riskRows.length : null,
      por_departamento: riskAvailable ? [...riskByDepartment].map(([departamento, total]) => ({ departamento, total })) : null,
      items: riskAvailable ? riskRows.map((row) => ({ colaborador_id: Number(row.colaborador_id),
        nombre: row.nombre, departamento: row.departamento, dias_disponibles: String(row.dias_disponibles) })) : null,
    },
    uso_chatbot: {
      consultas_dia_anterior: chatTotal,
      resueltas_sin_escalar_pct: chatTotal ? Number((Number(chat.resueltas_sin_escalar || 0) / chatTotal * 100).toFixed(2)) : null,
      latencia_promedio_ms: chatTotal && chat.latencia_promedio_ms !== null
        ? Number(Number(chat.latencia_promedio_ms).toFixed(2)) : null,
      tendencia_30_dias: trend,
    },
    temas_chatbot: { top_5: groupTopicRows(topicRows).slice(0, 5), sin_respuesta: unresolved },
    detalle_personas: {
      total: peopleRows.length,
      items: peopleRows.map((row) => ({
        colaborador_id: Number(row.colaborador_id),
        nombre: row.nombre,
        departamento: row.departamento,
        puesto: row.puesto,
        estado: row.estado,
        dias_vacaciones_disponibles: String(row.dias_vacaciones_disponibles),
        solicitudes_pendientes: Number(row.solicitudes_pendientes || 0),
        incapacidades_activas: Number(row.incapacidades_activas || 0),
        ausente_hoy: absentByPerson.has(Number(row.colaborador_id)),
      })),
    },
  };
  return report;
}

async function findByDate(date) {
  return models.ReporteDiario.findOne({ where: { fecha: date } });
}

async function list({ limit, offset }) {
  return models.ReporteDiario.findAndCountAll({
    attributes: ['id', 'fecha', 'generado_en', 'generado_por', 'origen', 'esquema_version', 'resumen_texto'],
    order: [['fecha', 'DESC']], limit, offset,
  });
}

async function queryOnConnection(connection, sql, params) {
  const [rows] = await connection.promise().query(sql, params);
  return rows;
}

async function withDateLock(date, operation) {
  const lockName = `bc_report_${date.replaceAll('-', '')}`;
  const connection = await sequelize.connectionManager.getConnection({ type: 'WRITE' });
  try {
    const [lock] = await queryOnConnection(connection, 'SELECT GET_LOCK(?, 0) AS acquired', [lockName]);
    if (Number(lock.acquired) !== 1) return { acquired: false };
    try { return { acquired: true, result: await operation() }; }
    finally {
      await queryOnConnection(connection, 'SELECT RELEASE_LOCK(?) AS released', [lockName]).catch(() => {});
    }
  } finally {
    await sequelize.connectionManager.releaseConnection(connection);
  }
}

async function createExecution({ date, data, summary, generatedAt }) {
  return models.ReporteDiario.create({
    fecha: date, datos_json: data, resumen_texto: summary, generado_por: 'agente_analista',
    generado_en: generatedAt, origen: 'ejecucion', esquema_version: 1,
  });
}

async function updateExecution(id, { data, summary, generatedAt }) {
  await models.ReporteDiario.update({
    datos_json: data, resumen_texto: summary, generado_por: 'agente_analista',
    generado_en: generatedAt, origen: 'ejecucion', esquema_version: 1,
  }, { where: { id } });
  return models.ReporteDiario.findByPk(id);
}

async function logAnalystExecution({ startedAt, finishedAt, state, errorCode = null, context = {} }) {
  return models.AgentExecutionLog.create({
    consulta_chat_id: null, tipo_ejecucion: 'reporte_diario', agente: 'agente_analista', consulta: null,
    contexto: context, origen: 'ejecucion', fragmentos_usados: null, escalada: false,
    latencia_ms: finishedAt ? Math.max(0, finishedAt.getTime() - startedAt.getTime()) : null,
    estado: state, codigo_error: errorCode, iniciada_en: startedAt, finalizada_en: finishedAt,
  });
}

module.exports = { aggregateReport, dateBefore, dateRange, findByDate, list, withDateLock, createExecution, updateExecution, logAnalystExecution, sequelize, asDate, asUtcInstant };
