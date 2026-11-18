const { DeepSeekClient } = require('../integrations/deepseek');
const SYSTEM = require('../prompts/policy-answer-v1');

class PolicyAgent {
  constructor({ search, llm = new DeepSeekClient(), minScore = Number(process.env.POLICY_MIN_SCORE || 0.35) } = {}) {
    this.search = search || (async (query) => {
      const { IngestionAgent } = require('./ingestion-agent');
      return new IngestionAgent().search(query, 8);
    });
    this.llm = llm;
    this.minScore = Number.isFinite(minScore) && minScore >= 0 && minScore <= 1 ? minScore : 0.35;
  }

  async answer(query) {
    const fragments = await this.search(query);
    const usable = (fragments || []).filter((fragment) => validFragment(fragment) && Number.isFinite(fragment.score) && fragment.score >= this.minScore);
    if (!usable.length) return { response: 'No encontré información suficiente en los documentos de políticas disponibles. Puedes consultar a RRHH.', citations: [], escalated: true, fragments: [] };
    const allowed = new Map(usable.map((fragment) => [fragment.fragmento_id, fragment]));
    const result = await this.llm.completeJson({ system: SYSTEM, maxTokens: 900, user: JSON.stringify({ pregunta: query,
      fuentes: usable.map(({ fragmento_id, documento, nombre, seccion, version, enlace, texto }) => ({ fragmento_id, documento: documento || nombre, seccion, version, enlace, texto })) }) });
    if (typeof result.respuesta !== 'string' || !Array.isArray(result.fragmento_ids) || typeof result.sin_respaldo !== 'boolean') throw new Error('POLICY_OUTPUT_INVALID');
    const ids = [...new Set(result.fragmento_ids.filter((id) => typeof id === 'string' && allowed.has(id)))];
    if (result.sin_respaldo || !result.respuesta.trim() || ids.length === 0 || ids.length !== new Set(result.fragmento_ids).size
      || !numbersSupported(result.respuesta, ids.map((id) => allowed.get(id).texto).join('\n'))) {
      return { response: 'No encontré información suficiente en los documentos de políticas disponibles. Puedes consultar a RRHH.', citations: [], escalated: true, fragments: usable };
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
