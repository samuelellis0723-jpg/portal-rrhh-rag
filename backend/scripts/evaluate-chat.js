const fs = require('node:fs/promises');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
require('../src/config/env');
const app = require('../src/app');
const models = require('../src/models');
const { QueryTypes } = require('sequelize');
const { authConfig } = require('../src/config/auth');

const bankPath = path.resolve(__dirname, '../../docs/evaluacion/banco-45.json');
const outputPath = path.resolve(__dirname, '../../docs/evaluacion/resultados-actuales.json');
const normalize = (text) => String(text || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const percentile = (values, fraction) => values.length ? [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * fraction) - 1)] : null;

async function main() {
  const bank = JSON.parse(await fs.readFile(bankPath, 'utf8'));
  const manifest = JSON.parse(await fs.readFile(path.resolve(__dirname, '../../docs/politicas/manifest.json'), 'utf8'));
  const origin = authConfig().origins[0];
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const url = `http://127.0.0.1:${server.address().port}/api/v1`;
  const actors = {};
  const report = { fecha_ejecucion: new Date().toISOString(), modo: 'HTTP/MySQL reales; proveedores según configuración local',
    deepseek_configurado: Boolean(process.env.DEEPSEEK_API_KEY), filas: [],
    alcance: 'Criterios automáticos estructurales, de procedencia y cifras propias. No sustituyen revisión humana de fidelidad semántica. Los errores de dependencia no son aciertos.',
  };
  async function save() {
    const rows = report.filas;
    report.resumen = { total_banco: 45, ejecutadas: rows.length,
      verificaciones_automaticas_aprobadas: rows.filter((row) => row.resultado === 'aprobada_automatica').length,
      fallidas: rows.filter((row) => row.resultado === 'fallida').length,
      bloqueadas: rows.filter((row) => row.resultado.startsWith('bloqueada')).length,
      acierto_automatico_sobre_45_pct: Number((rows.filter((row) => row.resultado === 'aprobada_automatica').length / 45 * 100).toFixed(2)),
      p90_todas_ms: percentile(rows.map((row) => row.latencia_ms), .9),
      p90_respuestas_con_documentos_ms: percentile(rows.filter((row) => row.http === 200 && row.citas?.length).map((row) => row.latencia_ms), .9),
      privacidad_21_22: rows.filter((row) => [21, 22].includes(row.id)).map((row) => ({ id: row.id, rechazo_generico: row.checks?.privacidad === true })),
      calidad_semantica_revision_humana: 'pendiente',
    };
    await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  try {
    for (const role of ['colaborador', 'rrhh']) {
      const response = await fetch(`${url}/auth/login`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `${role}@bosqueclaro.example`, password: process.env[role === 'rrhh' ? 'DEMO_RRHH_PASSWORD' : 'DEMO_COLABORADOR_PASSWORD'] }) });
      if (response.status !== 200) throw new Error('EVALUATION_DEMO_LOGIN_FAILED');
      const payload = await response.json();
      actors[role] = { cookie: response.headers.get('set-cookie').split(';')[0], csrf: payload.data.csrf_token, collaboratorId: payload.data.colaborador.id };
    }
    for (const entry of bank.preguntas) {
      const actor = actors[entry.rol];
      let response, payload, duration;
      for (let retry = 0; retry < 2; retry += 1) {
        const start = performance.now();
        response = await fetch(`${url}/chat`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: actor.cookie, 'X-CSRF-Token': actor.csrf }, body: JSON.stringify({ mensaje: entry.pregunta }) });
        duration = Math.round(performance.now() - start);
        payload = await response.json();
        if (response.status !== 429 || retry) break;
        const waitMs = Math.min(60000, Math.max(1000, Number(response.headers.get('retry-after') || 60) * 1000));
        console.log(`Evaluación: respetando límite de chat antes de pregunta ${entry.id}.`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
      const row = { id: entry.id, pregunta: entry.pregunta, rol: entry.rol, tipo_esperado: entry.tipo_esperado, respuesta_esperada: entry.respuesta_esperada,
        fuentes_esperadas: entry.fuentes, http: response.status, latencia_ms: duration, checks: {},
        respuesta_obtenida: payload.data?.respuesta || payload.error?.message || null,
        intencion: payload.data?.intencion || null, estado: payload.data?.estado || null, citas: payload.data?.citas || [], error_code: payload.error?.code || null };
      if (response.status === 503) row.resultado = 'bloqueada_dependencia';
      else if (response.status === 429) row.resultado = 'bloqueada_limite';
      else if (response.status === 404 && entry.tipo_esperado === 'reporte') row.resultado = 'bloqueada_reporte_no_publicado';
      else {
        row.checks.http = response.status === entry.http_esperado;
        if (entry.tipo_esperado === 'restringida') {
          row.checks.privacidad = response.status === 403 && payload.error?.code === 'FORBIDDEN'
            && payload.error.message === 'No tienes permiso para consultar este recurso.' && !payload.data;
        } else if (response.status === 200) {
          const data = payload.data;
          row.checks.respuesta = typeof data?.respuesta === 'string' && data.respuesta.trim().length > 0;
          if (entry.tipo_esperado === 'sin_respaldo') row.checks.abstencion = data.estado === 'sin_respaldo' && data.escalada === true && data.citas?.length === 0;
          else row.checks.intencion = data.intencion === entry.tipo_esperado;
          if (entry.documentos_esperados.length) {
            row.checks.fuente_documental = entry.documentos_esperados.some((id) => {
              const document = manifest.documents.find((item) => item.id === id);
              return document && data.citas?.some((citation) => normalize(citation.documento).includes(normalize(document.title)));
            });
            row.checks.trazabilidad = data.citas?.length > 0 && data.citas.every((citation) => {
              try { const link = new URL(citation.enlace); return citation.documento && citation.seccion && citation.version && citation.drive_file_id && citation.fragmento_id
                && link.protocol === 'https:' && ['drive.google.com', 'docs.google.com'].includes(link.hostname)
                && (link.pathname.includes(citation.drive_file_id) || link.searchParams.get('id') === citation.drive_file_id); } catch { return false; }
            });
          }
          if ([2, 19, 26, 30].includes(entry.id)) {
            const [expected] = await models.sequelize.query('SELECT CAST(COALESCE(SUM(dias_disponibles),0) AS DECIMAL(16,2)) AS n FROM saldos_vacaciones WHERE colaborador_id=:id', { replacements: { id: actor.collaboratorId }, type: QueryTypes.SELECT });
            row.checks.saldo_sql = data.dato_personal?.dias_disponibles === expected.n;
          }
          if (data.estado === 'parcial') row.resultado = 'bloqueada_respuesta_parcial';
        }
        row.resultado ||= Object.values(row.checks).every(Boolean) ? 'aprobada_automatica' : 'fallida';
      }
      report.filas.push(row);
      await save();
      console.log(`Pregunta ${entry.id}/45: HTTP ${response.status}, ${row.resultado}, ${duration} ms.`);
    }
    console.log(JSON.stringify(report.resumen, null, 2));
    process.exitCode = report.resumen.fallidas ? 1 : report.resumen.bloqueadas ? 2 : 0;
  } finally {
    for (const actor of Object.values(actors)) {
      await fetch(`${url}/auth/logout`, { method: 'POST', headers: { Origin: origin, Cookie: actor.cookie, 'X-CSRF-Token': actor.csrf } }).catch(() => {});
    }
    await new Promise((resolve) => { server.close(resolve); server.closeIdleConnections(); });
    await models.sequelize.close();
  }
}

main().catch(() => { console.error('No se completó la evaluación. Revisar servicios/configuración; no se imprimieron credenciales.'); process.exitCode = 1; });
