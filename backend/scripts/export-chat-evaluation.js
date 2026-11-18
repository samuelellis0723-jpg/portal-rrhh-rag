const fs = require('node:fs/promises');
const path = require('node:path');
const ExcelJS = require('exceljs');

async function exportEvaluation() {
  const directory = path.resolve(__dirname, '../../docs/evaluacion');
  const report = JSON.parse(await fs.readFile(path.join(directory, 'resultados-actuales.json'), 'utf8'));
  const columns = [
    ['id', 'N.º'], ['pregunta', 'Pregunta'], ['rol', 'Rol'], ['respuesta_esperada', 'Respuesta esperada'],
    ['respuesta_obtenida', 'Respuesta obtenida'], ['fuentes', 'Fuentes esperadas'], ['enlaces', 'Citas obtenidas'],
    ['http', 'HTTP'], ['intencion', 'Intención obtenida'], ['resultado', 'Resultado'], ['latencia_ms', 'Latencia ms'],
  ];
  const rows = report.filas.map((row) => ({ ...row, fuentes: row.fuentes_esperadas.join('\n'),
    enlaces: row.citas.map((citation) => `${citation.documento} · ${citation.seccion} · ${citation.version} · ${citation.enlace}`).join('\n') }));
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('45 preguntas');
  sheet.columns = columns.map(([key, header]) => ({ key, header, width: ['pregunta', 'respuesta_esperada', 'respuesta_obtenida', 'fuentes', 'enlaces'].includes(key) ? 50 : 23 }));
  rows.forEach((row) => sheet.addRow(row));
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: 'A1', to: 'K1' };
  sheet.eachRow((row) => { row.alignment = { vertical: 'top', wrapText: true }; });
  sheet.getRow(1).font = { bold: true };
  const summary = workbook.addWorksheet('Alcance y resultados');
  summary.columns = [{ header: 'Concepto', key: 'key', width: 44 }, { header: 'Valor', key: 'value', width: 90 }];
  for (const [key, value] of Object.entries(report.resumen)) summary.addRow({ key, value: typeof value === 'object' ? JSON.stringify(value) : value });
  summary.addRow({ key: 'Alcance', value: report.alcance });
  summary.addRow({ key: 'Advertencia', value: 'Bloqueos no son aciertos. Revisión humana de fidelidad y p90 RAG pendientes.' });
  summary.eachRow((row) => { row.alignment = { vertical: 'top', wrapText: true }; });
  await workbook.xlsx.writeFile(path.join(directory, 'evaluacion-45.xlsx'));
  const quote = (value) => `"${String(value ?? '').replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`;
  const csv = [columns.map(([, header]) => header), ...rows.map((row) => columns.map(([key]) => row[key]))]
    .map((row) => row.map(quote).join(',')).join('\r\n');
  await fs.writeFile(path.join(directory, 'evaluacion-45.csv'), `\ufeff${csv}\r\n`);
  console.log(JSON.stringify({ preguntas_exportadas: rows.length, formatos: ['xlsx', 'csv'], secretos: false }));
}

if (require.main === module) exportEvaluation().catch(() => { console.error('No se exportó la evaluación.'); process.exitCode = 1; });
module.exports = { exportEvaluation };
