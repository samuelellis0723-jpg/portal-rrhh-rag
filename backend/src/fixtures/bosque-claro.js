// Fixture determinista. Ninguna cifra representa una obligación o política legal.
const BASE = 91000000;
const START = '2026-08-18';
const END = '2026-11-17';
const dayMs = 86400000;
const day = (date, offset = 0) => new Date(Date.parse(`${date}T00:00:00Z`) + offset * dayMs).toISOString().slice(0, 10);
const instant = (date, hour = '09:00:00') => `${date}T${hour}-06:00`;
const departments = ['Dirección', 'Ingeniería', 'Operaciones', 'Comercial', 'Administración'];
const emailFor = (i) => i === 0 ? 'rrhh@bosqueclaro.example'
  : i === 1 ? 'colaborador@bosqueclaro.example'
    : `persona${String(i + 1).padStart(2, '0')}@bosqueclaro.example`;

function buildFixtures() {
  const data = Object.fromEntries([
    'colaboradores', 'usuarios', 'saldos_vacaciones', 'solicitudes', 'incapacidades',
    'movimientos_personal', 'pagos', 'evaluaciones', 'consultas_chat', 'agent_execution_logs', 'reportes_diarios',
  ].map((table) => [table, []]));
  const ids = Object.fromEntries(Object.keys(data).map((table) => [table, BASE]));
  const add = (table, row) => { const record = { id: ++ids[table], ...row }; data[table].push(record); return record; };

  for (let i = 0; i < 60; i++) {
    const collaboratorId = BASE + i + 1;
    const recentHire = i >= 54 && i < 58;
    const hired = recentHire ? day(START, (i - 54) * 20 + 1) : `2024-01-${String(i % 28 + 1).padStart(2, '0')}`;
    add('colaboradores', {
      nombre: `Persona Simulada ${String(i + 1).padStart(2, '0')}`, correo: emailFor(i),
      departamento: departments[i % departments.length], puesto: i === 0 ? 'Responsable RRHH' : 'Analista de servicios',
      fecha_ingreso: hired, jefe_id: i === 0 ? null : BASE + 1,
      estado: i >= 58 ? 'inactivo' : 'activo', rol: i === 0 ? 'rrhh' : 'colaborador',
    });
    add('usuarios', { colaborador_id: collaboratorId, password_hash: null, estado: 'activo', creado_en: instant(hired) });
    add('movimientos_personal', { colaborador_id: collaboratorId, tipo: 'ingreso', fecha: hired, motivo: 'Ingreso ficticio Bosque Claro' });
    if (i >= 58) add('movimientos_personal', {
      colaborador_id: collaboratorId, tipo: 'salida', fecha: day(START, 60 + i - 58), motivo: 'Salida simulada',
    });
    if (i > 1 && i < 5) add('movimientos_personal', {
      colaborador_id: collaboratorId, tipo: 'ascenso', fecha: day(START, i * 15), motivo: 'Ascenso simulado',
    });
    let taken = 0;
    for (const [month, monthStart, lastDay] of [['08', START, 31], ['09', '2026-09-01', 30], ['10', '2026-10-01', 31], ['11', '2026-11-01', 17]]) {
      const date = `2026-${month}-${String(20 + i % 5).padStart(2, '0')}`;
      const resolved = day(date, -4);
      if (date >= hired && date <= END && i < 58) {
        const vacation = i % 2 === 0;
        add('solicitudes', {
          colaborador_id: collaboratorId, tipo: vacation ? 'vacaciones' : 'permiso',
          fecha_inicio: date, fecha_fin: date, estado: 'aprobada', aprobador_id: BASE + 1,
          creada_en: instant(day(date, -5)), resuelta_en: instant(resolved),
        });
        if (vacation) taken++;
      }
      const periodEnd = `2026-${month}-${String(lastDay).padStart(2, '0')}`;
      if (periodEnd >= hired && i < 58) add('pagos', {
        colaborador_id: collaboratorId, tipo: 'salario', periodo_inicio: hired > monthStart ? hired : monthStart,
        periodo_fin: periodEnd, fecha_pago: periodEnd, monto: `${600000 + i * 5000}.00`, moneda: 'CRC', estado: 'pagado',
      });
    }
    // Casos activos en la fecha final; pendientes tanto recientes como vencidas.
    if (i < 12) {
      const approved = i < 4;
      add('solicitudes', {
        colaborador_id: collaboratorId, tipo: i % 2 ? 'permiso' : 'vacaciones',
        fecha_inicio: END, fecha_fin: approved ? END : day(END, 1), estado: approved ? 'aprobada' : 'pendiente',
        aprobador_id: BASE + 1, creada_en: instant(day(END, i < 8 ? -6 : -1)),
        resuelta_en: approved ? instant(day(END, -2)) : null,
      });
      if (approved && i % 2 === 0) taken++;
    }
    const assigned = i % 10 === 0 ? 30 : 14;
    add('saldos_vacaciones', {
      colaborador_id: collaboratorId, periodo_inicio: hired > '2026-01-01' ? hired : '2026-01-01', periodo_fin: '2026-12-31',
      dias_asignados: `${assigned}.00`, dias_tomados: `${taken}.00`, dias_disponibles: `${assigned - taken}.00`,
    });
    for (const offset of [12 + i % 10, 45 + i % 10, 88 + i % 3]) {
      const date = day(START, offset);
      if (i % 3 === 0 && date >= hired && i < 58) add('incapacidades', {
        colaborador_id: collaboratorId, tipo: i % 2 ? 'enfermedad_comun' : 'accidente_laboral',
        fecha_inicio: date, dias: 4, entidad: i % 2 ? 'CCSS' : 'INS', registrada_en: instant(date, '06:00:00'),
      });
    }
    if (i < 58) {
      if (hired <= '2026-09-30') add('evaluaciones', {
        colaborador_id: collaboratorId, fecha_programada: '2026-09-30', tipo: 'desempeno',
        estado: 'completada', completada_en: instant('2026-09-30'),
      });
      if (i !== 57) {
        add('pagos', { colaborador_id: collaboratorId, tipo: 'salario', periodo_inicio: '2026-11-18',
          periodo_fin: '2026-11-30', fecha_pago: '2026-11-30', monto: `${600000 + i * 5000}.00`, moneda: 'CRC', estado: 'programado' });
        add('evaluaciones', { colaborador_id: collaboratorId, fecha_programada: '2026-12-10', tipo: 'desempeno', estado: 'programada', completada_en: null });
      }
    }
  }
  for (let offset = 0; offset <= 91; offset++) {
    const date = day(START, offset);
    const count = 2 + offset % 4;
    for (let n = 0; n < count; n++) {
      const person = (offset + n) % 54;
      const unresolved = n === 0 && offset % 5 === 0;
      const consulta = add('consultas_chat', {
        colaborador_id: BASE + person + 1,
        pregunta: unresolved ? '¿Existe un beneficio académico no documentado?' : '¿Cuál es mi saldo de vacaciones?',
        intencion: unresolved ? 'politica' : 'dato_personal', agente: unresolved ? 'politicas' : 'datos',
        tema: unresolved ? 'beneficios' : 'vacaciones', origen: 'fixture', documentos_citados: [],
        resuelta: !unresolved, escalada: unresolved, latencia_ms: 100 + offset % 30,
        creada_en: instant(date, `10:${String(n).padStart(2, '0')}:00`),
      });
      for (const agente of ['orquestador', consulta.agente]) add('agent_execution_logs', {
        consulta_chat_id: consulta.id, tipo_ejecucion: 'chat', agente, consulta: consulta.pregunta,
        contexto: null, origen: 'fixture', fragmentos_usados: [], escalada: unresolved,
        latencia_ms: 40, estado: 'completada', codigo_error: null,
        iniciada_en: consulta.creada_en, finalizada_en: consulta.creada_en,
      });
    }
  }
  for (let offset = 0; offset <= 91; offset++) {
    const date = day(START, offset);
    const report = buildReport(data, date);
    add('reportes_diarios', { fecha: date, datos_json: report, resumen_texto: report.resumen_ejecutivo,
      generado_por: 'fixture_sin_llm', generado_en: instant(date, '07:00:00'), origen: 'fixture', esquema_version: 1 });
  }
  return data;
}

function buildReport(data, date) {
  const corte = Date.parse(instant(date, '07:00:00'));
  const monthStart = `${date.slice(0, 7)}-01`;
  const people = new Map(data.colaboradores.map((p) => [p.id, p]));
  const dept = (id) => people.get(id).departamento;
  const activeOn = (p, d) => p.fecha_ingreso <= d && !data.movimientos_personal.some((m) => m.colaborador_id === p.id && m.tipo === 'salida' && m.fecha <= d);
  const groups = {};
  const addAbsence = (type, id) => { groups[type].add(id); };
  for (const type of ['vacaciones', 'permiso', 'incapacidad']) groups[type] = new Set();
  for (const r of data.solicitudes) if (r.estado === 'aprobada' && Date.parse(r.resuelta_en) <= corte && r.fecha_inicio <= date && r.fecha_fin >= date) addAbsence(r.tipo, r.colaborador_id);
  const activeIncapacities = data.incapacidades.filter((r) => r.fecha_inicio <= date && day(r.fecha_inicio, r.dias - 1) >= date);
  for (const r of activeIncapacities) addAbsence('incapacidad', r.colaborador_id);
  const absent = new Set(Object.values(groups).flatMap((set) => [...set]));
  const pending = data.solicitudes.filter((r) => Date.parse(r.creada_en) <= corte && (!r.resuelta_en || Date.parse(r.resuelta_en) > corte));
  const pendingItems = pending.map((r) => ({ id: r.id, tipo: r.tipo, departamento: dept(r.colaborador_id),
    fecha_inicio: r.fecha_inicio, fecha_fin: r.fecha_fin, creada_en: new Date(r.creada_en).toISOString(),
    dias_pendiente: Math.floor((corte - Date.parse(r.creada_en)) / dayMs) }));
  const monthMovements = data.movimientos_personal.filter((m) => m.fecha >= monthStart && m.fecha <= date);
  const exits = monthMovements.filter((m) => m.tipo === 'salida').length;
  const initial = data.colaboradores.filter((p) => activeOn(p, monthStart)).length;
  const final = data.colaboradores.filter((p) => activeOn(p, date)).length;
  // Reconstrucción del saldo sintético al corte: los días aprobados del fixture son de un día.
  const risk = data.saldos_vacaciones.filter((s) => people.get(s.colaborador_id).fecha_ingreso <= date && activeOn(people.get(s.colaborador_id), date)).map((s) => {
    const used = data.solicitudes.filter((r) => r.colaborador_id === s.colaborador_id && r.tipo === 'vacaciones' && r.estado === 'aprobada' && r.fecha_inicio <= date && Date.parse(r.resuelta_en) <= corte).length;
    return { colaborador_id: s.colaborador_id, departamento: dept(s.colaborador_id), dias_disponibles: (Number(s.dias_asignados) - used).toFixed(2) };
  }).filter((r) => Number(r.dias_disponibles) > 20);
  const yesterday = day(date, -1);
  const chats = data.consultas_chat.filter((r) => r.creada_en.slice(0, 10) === yesterday);
  const trend = Array.from({ length: 30 }, (_, i) => day(date, i - 30)).map((d) => ({ fecha: d,
    // No conocemos datos anteriores a START: no representarlos como ceros observados.
    consultas: d < START ? null : data.consultas_chat.filter((r) => r.creada_en.slice(0, 10) === d).length }));
  const topicCounts = {};
  const noAnswers = {};
  for (const c of chats) { topicCounts[c.tema] = (topicCounts[c.tema] || 0) + 1; if (!c.resuelta) noAnswers[c.pregunta] = (noAnswers[c.pregunta] || 0) + 1; }
  const report = {
    ausencias: { fecha: date, total: absent.size,
      por_tipo: Object.fromEntries(Object.entries(groups).map(([t, ids]) => [t, ids.size])),
      por_departamento: departments.map((departamento) => ({ departamento,
        total: [...absent].filter((id) => dept(id) === departamento).length,
        por_tipo: Object.fromEntries(Object.entries(groups).map(([t, ids]) => [t, [...ids].filter((id) => dept(id) === departamento).length])) })) },
    solicitudes_pendientes: { total: pending.length, mas_de_3_dias: pending.filter((r) => corte - Date.parse(r.creada_en) > 3 * dayMs).length, items: pendingItems },
    incapacidades: { activas: activeIncapacities.length, dias_acumulados_mes: data.incapacidades.reduce((sum, r) => {
      const first = r.fecha_inicio > monthStart ? r.fecha_inicio : monthStart;
      const end = day(r.fecha_inicio, r.dias - 1); const last = end < date ? end : date;
      return sum + Math.max(0, Math.round((Date.parse(last) - Date.parse(first)) / dayMs) + 1);
    }, 0) },
    movimientos_personal: { ingresos_mes: monthMovements.filter((r) => r.tipo === 'ingreso').length,
      salidas_mes: exits, dotacion_inicio_mes: initial, dotacion_corte: final,
      rotacion_acumulada_pct: initial + final ? Number((exits / ((initial + final) / 2) * 100).toFixed(2)) : null,
      formula: 'salidas_mes / ((dotacion_inicio_mes + dotacion_corte) / 2) * 100' },
    riesgo_vacaciones: { umbral_dias: 20, total_colaboradores: risk.length, items: risk,
      por_departamento: departments.map((departamento) => ({ departamento, total: risk.filter((r) => r.departamento === departamento).length })) },
    uso_chatbot: { consultas_dia_anterior: yesterday < START ? null : chats.length,
      resueltas_sin_escalar_pct: chats.length ? Number((chats.filter((r) => r.resuelta && !r.escalada).length / chats.length * 100).toFixed(2)) : null,
      latencia_promedio_ms: chats.length ? Number((chats.reduce((sum, r) => sum + r.latencia_ms, 0) / chats.length).toFixed(2)) : null,
      tendencia_30_dias: trend },
    temas_chatbot: { top_5: Object.entries(topicCounts).map(([tema, consultas]) => ({ tema, consultas })).sort((a, b) => b.consultas - a.consultas).slice(0, 5),
      sin_respuesta: Object.entries(noAnswers).map(([pregunta, consultas]) => ({ pregunta, consultas })) },
  };
  report.resumen_ejecutivo = `Hay ${report.ausencias.total} personas ausentes. Se registran ${pending.length} solicitudes pendientes. Hay ${activeIncapacities.length} incapacidades activas. Este resumen es un fixture sintético sin ejecución de IA.`;
  return report;
}

module.exports = { BASE, START, END, day, buildFixtures, buildReport };
