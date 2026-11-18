const fs = require('node:fs');
const policyDir = __dirname;
const d02 = `${policyDir}/D02-feriados-2026.csv`;
let holidays = fs.readFileSync(d02, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
const allLines = holidays.split('\n');
const metadata = allLines.slice(0, allLines.findIndex((line) => line.startsWith('fecha,'))).filter(Boolean);
const dataByDate = new Map(allLines.filter((line) => /^2026-\d\d-\d\d,/.test(line)).map((line) => {
  const clean = line.replace(/,https?:\/\/.*$/, '');
  const cells = clean.split(',').slice(0, 5);
  return [cells[0], `${cells.join(',')},https://www.mtss.go.cr/temas-laborales/feriados/feriados_calendario_2026.pdf`];
}));
const data = [...dataByDate.values()];
fs.writeFileSync(d02, `\uFEFF${metadata.join('\n')}\n\nfecha,evento,dia_semana,tipo_feriado,nota,fuente_url\n${data.join('\n')}\n`);

const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const rows = [];
for (let month = 0; month < 12; month += 1) {
  for (const day of [15, days[month]]) {
    const date = new Date(Date.UTC(2026, month, day));
    while (date.getUTCDay() === 0 || date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() - 1);
    const label = day === 15 ? 'Pago ordinario quincenal propuesto' : 'Pago ordinario de fin de mes propuesto';
    const note = 'Propuesta: día 15 o último día calendario; si cae en fin de semana se propone el día hábil anterior. No adoptado; confirmar calendario vigente.';
    rows.push(`${date.toISOString().slice(0, 10)},${label},Propuesta interna,"${note}",`);
  }
}
rows.push('2026-11-30,Cierre de período para cómputo del aguinaldo,Referencia legal,"Período 1 dic anterior–30 nov; no es pago individual",https://www.mtss.go.cr/temas-laborales/aguinaldo/preguntas_frecuentes.pdf');
rows.push('2026-12-20,Fecha límite general de pago de aguinaldo,Referencia legal,"Ley 2412: dentro de los primeros veinte días de diciembre; validar calendario laboral",https://www.mtss.go.cr/temas-laborales/aguinaldo/preguntas_frecuentes.pdf');
const meta = 'Título,Calendario general de pagos y obligaciones 2026\nVersión,0.1\nResponsable,Planillas\nFecha,2026-11-17\nVigencia propuesta,2026-11-17 (solo simulación; sin adopción empresarial)\nSección,Remuneración\nEstado,Borrador académico no aprobado\n\n';
fs.writeFileSync(`${policyDir}/D07-calendario-pagos-2026.csv`, `${meta}fecha,evento,origen,nota,fuente_url\n${rows.join('\n')}\n`);
