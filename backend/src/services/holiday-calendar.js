const { citation } = require('../agents/policy-agent');
const { todayCR } = require('../agents/data-agent');

// Solo datos derivados del calendario publicado; no se introducen feriados en código.
function answerHoliday(query, fragments, now) {
  if (!/\bferiados?\b/i.test(query)) return null;
  const text = query.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const calendars = fragments.filter((f) => f.external_document_id === 'D02' || /calendario.*feriados/i.test(f.documento || f.nombre));
  const rows = [];
  for (const fragment of calendars) {
    for (const line of fragment.texto.split('\n')) {
      const match = line.match(/^(Fila \d+: )?(20\d{2}-\d{2}-\d{2})\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*(no obligatorio|obligatorio)\b/i);
      if (match) rows.push({ date: match[2], name: match[3].trim(), weekday: match[4].trim(), type: match[5],
        fragment, section: `${fragment.seccion}${match[1] ? ` · ${match[1].trim().replace(/:$/, '')}` : ''}` });
    }
  }
  const dates = [...new Map(rows.map((row) => [row.date, row])).values()].sort((a, b) => a.date.localeCompare(b.date));
  const today = todayCR(now);
  const year = text.match(/\b20\d{2}\b/)?.[0] || today.slice(0, 4);
  const next = /proximo|cuando\s+es\s+(?:el\s+)?feriado/.test(text);
  const remaining = /quedan|restan|resto/.test(text);
  if (!next && !remaining) return null;
  const eligible = dates.filter((row) => row.date > today && row.date.startsWith(year));
  if (!eligible.length) return { response: `La fecha actual en Costa Rica es ${today}. No encontré próximos feriados respaldados para esa fecha en el calendario publicado. Consulta a RRHH por el calendario del período correspondiente.`, citations: [], escalated: true, fragments: calendars };
  const selected = next ? eligible.slice(0, 1) : eligible;
  const used = [...new Map(selected.map((row) => [row.fragment.fragmento_id, row])).values()];
  const detail = selected.map((row) => `${row.date} (${row.weekday}), ${row.name}, de pago ${row.type}`).join('; ');
  return { response: `Con fecha de referencia ${today} en Costa Rica, ${next ? 'el próximo feriado publicado es' : 'los feriados publicados que quedan este año son'}: ${detail}. El tratamiento del pago depende de la modalidad salarial; confirma tu caso con Planillas. Calendario académico propuesto, versión ${used[0].fragment.version}.`,
    citations: used.map((row) => ({ ...citation(row.fragment), seccion: [...new Set(selected.filter((item) => item.fragment.fragmento_id === row.fragment.fragmento_id).map((item) => item.section))].join('; ') })), escalated: false, fragments: used.map((row) => row.fragment) };
}
module.exports = { answerHoliday };
