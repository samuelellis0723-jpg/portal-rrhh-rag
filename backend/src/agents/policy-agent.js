const { DeepSeekClient } = require('../integrations/deepseek');
const SYSTEM = require('../prompts/policy-answer-v1');

class PolicyAgent {
  constructor({ search, llm = new DeepSeekClient(), clock = () => new Date(), minScore = Number(process.env.POLICY_MIN_SCORE || 0.35) } = {}) {
    this.search = search || (async (query) => {
      const { IngestionAgent } = require('./ingestion-agent');
      return new IngestionAgent().search(query, 8);
    });
    this.llm = llm;
    this.clock = clock;
    this.minScore = Number.isFinite(minScore) && minScore >= 0 && minScore <= 1 ? minScore : 0.35;
  }

  async answer(query) {
    const fragments = await this.search(query);
    const usable = (fragments || []).filter((fragment) => validFragment(fragment) && Number.isFinite(fragment.score) && fragment.score >= this.minScore);
    if (!usable.length) return { response: 'No encontré información suficiente en los documentos de políticas disponibles. Puedes consultar a RRHH.', citations: [], escalated: true, fragments: [] };
    const calendar = require('../services/holiday-calendar').answerHoliday(query, usable, this.clock());
    if (calendar) return calendar;
    const allowed = new Map(usable.map((fragment) => [fragment.fragmento_id, fragment]));
    const input = { pregunta: query, fecha_actual_costa_rica: require('./data-agent').todayCR(this.clock()),
      fuentes: usable.map(({ fragmento_id, documento, nombre, seccion, version, enlace, texto }) => ({ fragmento_id, documento: documento || nombre, seccion, version, enlace, texto })) };
    let result, ids;
    for (let attempt = 0; attempt < 2; attempt++) {
      result = await this.llm.completeJson({ system: SYSTEM, maxTokens: 900, user: JSON.stringify(input) });
      if (typeof result.respuesta !== 'string' || !Array.isArray(result.fragmento_ids) || typeof result.sin_respaldo !== 'boolean') throw new Error('POLICY_OUTPUT_INVALID');
      ids = [...new Set(result.fragmento_ids.filter((id) => typeof id === 'string' && allowed.has(id)))];
      const validIds = ids.length > 0 && ids.length === new Set(result.fragmento_ids).size;
      const numericEvidence = ids.map((id) => { const f = allowed.get(id); return `${f.seccion}\nVersión ${f.version}\n${f.texto}`; }).join('\n');
      const groundedNumbers = numbersSupported(result.respuesta, numericEvidence);
      if (result.sin_respaldo || !result.respuesta.trim() || !validIds || (!groundedNumbers && attempt === 1)) {
        return { response: 'No encontré información suficiente en los documentos de políticas disponibles. Puedes consultar a RRHH.', citations: [], escalated: true, fragments: usable };
      }
      if (groundedNumbers) break;
      // Una única corrección con las mismas fuentes. Nunca admitir números desde la pregunta como evidencia.
      input.validacion = 'Redacta otra respuesta breve usando exclusivamente las fuentes. No repitas cantidades de la pregunta ni conviertas cantidades escritas con palabras en cifras. Conserva números de sección y versión solo si citas su fuente. No calcules montos individuales.';
    }
    return { response: result.respuesta.trim(), citations: ids.map((id) => citation(allowed.get(id))), escalated: false, fragments: ids.map((id) => allowed.get(id)) };
  }
}

function validFragment(item) {
  return item && typeof item.fragmento_id === 'string' && typeof (item.documento || item.nombre) === 'string'
    && typeof item.drive_file_id === 'string' && typeof item.seccion === 'string' && typeof item.version === 'string' && validDriveLink(item.enlace, item.drive_file_id)
    && typeof item.texto === 'string' && item.texto.trim();
}
function validDriveLink(link, fileId) {
  try {
    const url = new URL(link);
    if (url.protocol !== 'https:' || !['drive.google.com', 'docs.google.com'].includes(url.hostname)) return false;
    const id = url.searchParams.get('id') || url.pathname.match(/\/d\/([^/]+)/)?.[1] || url.pathname.match(/\/file\/([^/]+)/)?.[1];
    return id === fileId;
  } catch { return false; }
}
function numbersSupported(answer, evidence) {
  const values = [...answer.matchAll(/\d+(?:[.,]\d+)*/g)].map(([value]) => value.replace(',', '.').replace(/\.0+$/, ''));
  const cited = new Set([...evidence.matchAll(/\d+(?:[.,]\d+)*/g)].map(([value]) => value.replace(',', '.').replace(/\.0+$/, '')));
  return values.every((value) => cited.has(value));
}
function citation(item) {
  return { documento: item.documento || item.nombre, seccion: item.seccion, version: item.version, drive_file_id: item.drive_file_id,
    fragmento_id: item.fragmento_id, enlace: item.enlace, fragmento: item.texto };
}

module.exports = { PolicyAgent, validFragment, validDriveLink, citation, numbersSupported };
