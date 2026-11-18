const { DeepSeekClient } = require('../integrations/deepseek');
const { DataAgent } = require('../agents/data-agent');
const { PolicyAgent } = require('../agents/policy-agent');
const repo = require('../repositories/personal-chat-repository');
const privacyRepo = require('../repositories/privacy-chat-repository');
const ApiError = require('./api-error');

const CLASSIFIER_SYSTEM = require('../prompts/chat-classifier-v1');
const FORBIDDEN = 'No tienes permiso para consultar este recurso.';

class ChatService {
  constructor({ llm = new DeepSeekClient(), dataAgent = new DataAgent(), policyAgent = new PolicyAgent(), repository = repo,
    privacy = privacyRepo, clock = () => new Date() } = {}) {
    Object.assign(this, { llm, dataAgent, policyAgent, repository, privacy, clock });
  }

  async ask({ collaboratorId, role, message }) {
    const started = this.clock();
    const loggedMessage = redactSecrets(message);
    const chat = await this.repository.createChat({ colaboradorId: collaboratorId, pregunta: loggedMessage, creadaEn: started });
    const timings = new Map();
    const execute = async (agent, operation, context = {}) => {
      const begin = this.clock();
      try {
        const value = await operation();
        timings.set(agent, { state: 'completada', started: begin, elapsed: elapsed(begin, this.clock()), context, escalated: false });
        return value;
      } catch (error) {
        timings.set(agent, { state: 'fallida', started: begin, elapsed: elapsed(begin, this.clock()), context, escalated: false, error: errorCode(error) });
        throw error;
      }
    };
    let orchestratorContext = {};
    try {
      const denied = loggedMessage !== message || isExplicitlyThirdParty(message) || await this.privacy.mentionsAnotherCollaborator(message, collaboratorId);
      if (denied) throw new ApiError(403, 'FORBIDDEN', FORBIDDEN);
      if (isReportRequest(message) && role !== 'rrhh') throw new ApiError(403, 'FORBIDDEN', FORBIDDEN);

      const memory = this.repository.recentConversationMemory
        ? await this.repository.recentConversationMemory(collaboratorId, chat.id, 5)
        : await this.repository.recentPolicyMemory(collaboratorId, chat.id, 5);
      const resolvedMessage = resolveFollowup(message, memory);
      const resolvedDenied = resolvedMessage !== message && (isExplicitlyThirdParty(resolvedMessage)
        || await this.privacy.mentionsAnotherCollaborator(resolvedMessage, collaboratorId));
      if (resolvedDenied) throw new ApiError(403, 'FORBIDDEN', FORBIDDEN);
      const personalIntent = selectOwnPersonalIntent(resolvedMessage);
      const direct = personalIntent ? { intencion: asksAboutPolicy(resolvedMessage) ? 'mixta' : 'dato_personal', tema: personalTheme(personalIntent) }
        : isReportRequest(resolvedMessage) ? { intencion: 'reporte', tema: 'otro' }
          : isClearlyOutside(resolvedMessage) ? { intencion: 'fuera', tema: 'otro' } : null;
      // Las consultas inequívocas usan rutas de lectura fijas; no requieren una llamada LLM ficticia.
      const classification = await execute('clasificador', () => direct || this.llm.completeJson({ system: CLASSIFIER_SYSTEM, maxTokens: 250,
        user: JSON.stringify({ consulta: resolvedMessage, contexto_previo: memory.map(({ pregunta, tema, intencion }) => ({ pregunta, tema, intencion })) }) }),
      { metodo: direct ? 'regla_permitida' : 'deepseek' });
      if (!validClassification(classification)) throw new Error('CHAT_CLASSIFICATION_INVALID');
      if (classification.intencion === 'restringida') throw new ApiError(403, 'FORBIDDEN', FORBIDDEN);
      const hasPolicyPart = personalIntent && (asksAboutPolicy(resolvedMessage) || classification.intencion === 'mixta');
      let intent, response, citations = [], personalData, reportMetadata, parts, escalated = false, state = 'respondida';
      if (personalIntent) {
        intent = hasPolicyPart ? 'mixta' : 'dato_personal';
        if (hasPolicyPart) {
          const policyQuery = policyOnlyQuestion(resolvedMessage);
          const [personalRun, policyRun] = await Promise.allSettled([
            execute('datos', () => this.dataAgent.answer(resolvedMessage, collaboratorId, personalIntent), { personal_type: personalIntent }),
            execute('politicas', () => this.policyAgent.answer(policyQuery)),
          ]);
          const personal = personalRun.status === 'fulfilled' ? personalRun.value : null;
          const policy = policyRun.status === 'fulfilled' ? policyRun.value : null;
          if (!personal && (!policy || policy.escalated)) throw new Error('MIXED_SOURCES_UNAVAILABLE');
          personalData = personal?.data;
          citations = policy?.citations || [];
          response = [personal?.response || 'No fue posible consultar tus datos personales en este momento.',
            policy?.response || 'No fue posible verificar la parte de políticas en este momento. Consulta a RRHH.'].join(' ');
          parts = { datos: personal ? 'respondida' : 'no_disponible', politicas: !policy ? 'no_disponible' : policy.escalated ? 'sin_respaldo' : 'respondida' };
          if (!personal || !policy || policy.escalated) { state = 'parcial'; escalated = true; }
          if (policy) Object.assign(timings.get('politicas'), { escalated: policy.escalated,
            context: { fragmentos_usados: policy.fragments.map((fragment) => ({ fragmento_id: fragment.fragmento_id,
              drive_file_id: fragment.drive_file_id, seccion: fragment.seccion, version: fragment.version })) } });
        } else {
          const personal = await execute('datos', () => this.dataAgent.answer(resolvedMessage, collaboratorId, personalIntent), { personal_type: personalIntent });
          response = personal.response;
          personalData = personal.data;
        }
      } else if (classification.intencion === 'reporte' || isReportRequest(resolvedMessage)) {
        if (role !== 'rrhh') throw new ApiError(403, 'FORBIDDEN', FORBIDDEN);
        intent = 'reporte';
        const report = await execute('reportes', () => this.dataAgent.report(reportDateFromMessage(resolvedMessage, started), resolvedMessage));
        response = report.response;
        reportMetadata = report.data;
      } else if (classification.intencion === 'restringida') {
        throw new ApiError(403, 'FORBIDDEN', FORBIDDEN);
      } else if (classification.intencion === 'fuera') {
        intent = 'fuera_de_alcance';
        response = 'Esta consulta está fuera de la información disponible en el portal. Puedes consultar a RRHH.';
        state = 'fuera_de_alcance';
      } else if (classification.intencion === 'dato_personal' || classification.intencion === 'mixta') {
        intent = 'dato_personal';
        response = 'No pude identificar con seguridad cuál de tus datos personales consultas. Puedes reformular la pregunta o consultar a RRHH.';
        escalated = true;
        state = 'sin_respaldo';
      } else {
        intent = 'politica';
        const policy = await execute('politicas', () => this.policyAgent.answer(policyOnlyQuestion(resolvedMessage)));
        response = policy.response;
        citations = policy.citations;
        escalated = policy.escalated;
        if (escalated) state = 'sin_respaldo';
        Object.assign(timings.get('politicas'), { escalated, context: { fragmentos_usados: policy.fragments.map(({ fragmento_id, drive_file_id, seccion, version }) => ({ fragmento_id, drive_file_id, seccion, version })) } });
      }
      const result = { respuesta: response, estado: state, ...(personalData ? { dato_personal: personalData } : {}), ...(parts ? { partes: parts } : {}), ...(reportMetadata ? { reporte: reportMetadata } : {}) };
      orchestratorContext = { tema: validTheme(classification.tema), intent, citations: citations.map((citation) => citation.fragmento_id), escalated,
        ...(resolvedMessage !== message ? { followup_resuelto: true } : {}) };
      await this.repository.completeChat(chat.id, { intencion: intent, agente: 'orquestador', tema: validTheme(classification.tema), respuesta_json: result,
        documentos_citados: citations, resuelta: state === 'respondida', escalada: escalated, latencia_ms: elapsed(started, this.clock()) });
      await this.saveLogs(chat.id, loggedMessage, timings, started, orchestratorContext);
      return { consulta_id: chat.id, intencion: intent, respuesta: response, estado: state, citas: citations,
        ...(personalData ? { dato_personal: personalData } : {}), ...(parts ? { partes: parts } : {}), ...(reportMetadata ? { reporte: reportMetadata } : {}), escalada: escalated, creada_en: started };
    } catch (error) {
      const code = errorCode(error);
      const denied = error instanceof ApiError && error.code === 'FORBIDDEN';
      await this.repository.completeChat(chat.id, { intencion: denied ? 'restringida' : 'otro', agente: 'orquestador', tema: 'otro',
        respuesta_json: { respuesta: denied ? FORBIDDEN : 'No fue posible completar esta consulta. Puedes volver a intentarlo.', estado: denied ? 'restringida' : 'error' },
        documentos_citados: [], resuelta: false, escalada: true, latencia_ms: elapsed(started, this.clock()) }).catch(() => {});
      await this.saveLogs(chat.id, loggedMessage, timings, started, { ...orchestratorContext, ...(denied ? { denied: true } : {}), error: code });
      if (error instanceof ApiError) throw error;
      throw new ApiError(503, 'DEPENDENCY_UNAVAILABLE', 'El servicio de chat no está disponible temporalmente.');
    }
  }

  async saveLogs(chatId, message, timings, started, context) {
    for (const [agent, run] of timings) {
      await this.repository.addExecution({ consulta_chat_id: chatId, agente: agent, consulta: message, contexto: run.context,
        fragmentos_usados: run.context.fragmentos_usados || null, escalada: run.escalated, estado: run.state, codigo_error: run.error || null, iniciada_en: run.started,
        finalizada_en: new Date(run.started.getTime() + run.elapsed), latencia_ms: run.elapsed });
    }
    const end = this.clock();
    await this.repository.addExecution({ consulta_chat_id: chatId, agente: 'orquestador', consulta: message, contexto: context,
      escalada: Boolean(context.escalated || context.denied || context.error), estado: context.error ? 'fallida' : 'completada',
      codigo_error: context.error || null, iniciada_en: started, finalizada_en: end, latencia_ms: elapsed(started, end) });
  }
}

function selectOwnPersonalIntent(message) {
  const s = message.normalize('NFKC').toLowerCase();
  if (/\bcu[aá]ntos?\s+d[ií]as?\s+me\s+quedan\b/.test(s) && !/\b(?:incapacidad|maternidad|licencia)\b/.test(s)) return 'saldo_vacaciones';
  if (/\b(?:mi|mis)\s+(?:saldo|vacaciones|periodos?\s+de\s+vacaciones)\b/.test(s)
    || /\b(?:cu[aá]nt[oa]s?\s+(?:d[ií]as?\s+)?(?:de\s+)?vacaciones\s+(?:tengo|me\s+quedan|me\s+quedan\s+disponibles|tengo\s+disponibles)|cu[aá]nt[oa]s?\s+d[ií]as?\s+tengo)\b/.test(s)
    || /\b(?:tengo|me\s+quedan)\s+(?:(?:d[ií]as?\s+)?(?:disponibles?\s+)?(?:de\s+)?vacaciones|(?:d[ií]as?\s+)?vacaciones?\s+disponibles?)\b/.test(s)) return 'saldo_vacaciones';
  if (/\b(?:mi\s+pago|mis\s+pagos|mi\s+salario|cu[aá]ndo\s+me\s+pagan|cu[aá]ndo\s+cobro|pr[oó]ximo\s+pago)\b/.test(s)) return 'proximo_pago';
  if (/\b(?:pr[oó]xima\s+evaluaci[oó]n|cu[aá]ndo\s+es\s+mi\s+evaluaci[oó]n)\b/.test(s)) return 'proxima_evaluacion';
  if (/\b(?:mi\s+solicitud|mis\s+solicitudes|solicitudes\s+que\s+(?:hice|present[eé]))\b/.test(s)) return 'solicitudes';
  return null;
}
function asksAboutPolicy(message) { return /\b(?:pol[ií]tica|regla|procedimiento|revisi[oó]n|apelaci[oó]n|c[oó]mo\s+(?:pido|solicito)|permit(?:e|ido|ida|en)|acumul|traslad|pas(?:ar|arlo|arlos|arlas)|otro\s+a[ñn]o|a[ñn]o\s+siguiente|aprobaci[oó]n|obligaci[oó]n\s+legal|ley)\b/i.test(message); }
function isExplicitlyThirdParty(message) {
  if (/\b(?:vacaciones|saldos?|salarios?|sueldos?|evaluaci[oó]n|pagos?)\b[\s\S]{0,160}\b(?:mi\s+(?:compa(?:ñ|n)er[oa]|colega|gerente|director)|(?:otra|otras)\s+personas?)\b/i.test(message)) return true;
  if (/\b(?:salarios?|sueldos?|vacaciones|saldos?|evaluaci[oó]n|pagos?)\b[\s\S]{0,180}\b(?:del?\s+(?:gerente|director|administrador|colaborador|empleado)|de\s+todos|de\s+los\s+dem[aá]s|ajenos?|de\s+otra\s+persona)\b/i.test(message)) return true;
  return /(?:\bcolaborador[_ ]?id\b|\b(?:correo|email)\s*[:=]|\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b|\b(?:de|para)\s+(?:otra\s+persona|tercero|(?:un|el|la)\s+(?:jef[ae]|supervisor[ae]?|compa(?:ñ|n)er[oa]|colega|colaborador[ae]?|emplead[oa])|mi\s+(?:jef[ae]|supervisor[ae]?|compa(?:ñ|n)er[oa]|colega)|alguien\s+m[aá]s)\b)/i.test(message);
}
function validClassification(value) { return value && typeof value === 'object' && ['politica','dato_personal','mixta','reporte','restringida','fuera'].includes(value.intencion)
  && ['vacaciones','solicitudes','pagos','evaluaciones','politicas','otro'].includes(value.tema); }
function validTheme(value) { return ['vacaciones','solicitudes','pagos','evaluaciones','politicas','otro'].includes(value) ? value : 'otro'; }
function resolveFollowup(message, memory) {
  const previous = memory?.[0];
  if (!previous || !/\b(?:y\s+cu[aá]ndo|y\s+cu[aá]l|entonces|puedo\s+(?:hacerlo|pasarlos|trasladarlos)|eso|esa\s+regla|al\s+otro\s+a[ñn]o)\b/i.test(message)) return message;
  if (previous.intencion === 'dato_personal') {
    const type = selectOwnPersonalIntent(previous.pregunta);
    const queries = { saldo_vacaciones: 'mi saldo de vacaciones', proximo_pago: 'mi próximo pago', proxima_evaluacion: 'mi próxima evaluación', solicitudes: 'mis solicitudes' };
    return queries[type] ? `Seguimiento sobre ${queries[type]}: ${message}` : message;
  }
  return `Contexto previo de política: ${previous.pregunta}. Respuesta previa: ${previous.respuesta || ''}. Seguimiento: ${message}`;
}
function isReportRequest(message) { return /\b(?:reportes?|informes?|dashboard|resumen\s+ejecutivo|indicadores\s+de\s+rrhh|cu[aá]ntas?\s+(?:personas|colaboradores|empleados))\b/i.test(message); }
function policyOnlyQuestion(message) {
  if (message.startsWith('Contexto previo de política:')) return `Consulta sobre política: ${message.trim()}`;
  const clauses = message.split(/\b(?:y|adem[aá]s|tambi[eé]n)\b|[,;]|\?+/i).map((part) => part.trim()).filter(Boolean);
  const selected = clauses.find((part) => asksAboutPolicy(part) || /\b(?:puedo|se\s+puede|est[aá]\s+permitido)\b/i.test(part));
  const source = selected || message;
  return `Consulta sobre política: ${source.replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, '').trim()}`;
}
function personalTheme(type) { return ({ saldo_vacaciones: 'vacaciones', proximo_pago: 'pagos', proxima_evaluacion: 'evaluaciones', solicitudes: 'solicitudes' })[type] || 'otro'; }
function isClearlyOutside(message) { return /\b(?:recomiendas?|recomienda|recomendar)\b[\s\S]{0,70}\b(?:pel[ií]cula|receta|serie|videojuego)\b/i.test(message); }
function redactSecrets(message) {
  return message.replace(/\b(contrase[nñ]a|password|token|api[_ -]?key|authorization|cookie)\s*(?:es|[:=])\s*(?:bearer\s+)?\S+/gi, '$1: [secreto omitido]')
    .replace(/\b(AI_API_KEY|INGEST_EMBEDDING_API_KEY|DEEPSEEK_API_KEY|QDRANT_API_KEY|DB_PASSWORD|CSRF_SECRET)\s*[:=]\s*\S+/gi, '$1=[secreto omitido]')
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[clave omitida]');
}
function reportDateFromMessage(message, now) {
  const match = message.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (!match) return require('../agents/data-agent').todayCR(now);
  const date = new Date(`${match[1]}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== match[1]) throw new ApiError(400, 'VALIDATION_ERROR', 'La fecha del reporte no es válida.');
  return match[1];
}
function elapsed(start, end) { return Math.max(0, Math.min(2147483647, end.getTime() - start.getTime())); }
function errorCode(error) { return String(error.code || error.message || 'CHAT_ERROR').replace(/[^A-Za-z0-9_]/g, '_').slice(0, 80); }

module.exports = { ChatService, selectOwnPersonalIntent, asksAboutPolicy, isExplicitlyThirdParty, validClassification, resolveFollowup, isReportRequest };
