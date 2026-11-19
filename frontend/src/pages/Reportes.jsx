import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import WorkspaceLayout from '../components/WorkspaceLayout';
import { ErrorMessage, Loading } from '../components/Feedback';
import Pagination from '../components/Pagination';
import { DepartmentChart, TrendChart } from '../components/ReportCharts';
import MonthlyReportsSection from '../components/MonthlyReportsSection';
import { generateTodayReport, getReport, getReports } from '../services/reportes';

function todayCostaRica() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

const value = (number, suffix = '') => number === null || number === undefined ? 'Sin datos' : `${number}${suffix}`;
function Metric({ label, number, detail }) {
  return <div className="report-metric"><span>{label}</span><strong>{value(number)}</strong><p>{detail}</p></div>;
}

export default function Reportes() {
  const todayDate = todayCostaRica();
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [offset, setOffset] = useState(0);
  const [date, setDate] = useState('');
  const [hasTodayReport, setHasTodayReport] = useState(false);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [historyAttempt, setHistoryAttempt] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [confirmingUpdate, setConfirmingUpdate] = useState(false);
  const [lastActionUpdate, setLastActionUpdate] = useState(false);
  const [personFilter, setPersonFilter] = useState('');
  const [peopleOffset, setPeopleOffset] = useState(0);
  const [peopleLimit, setPeopleLimit] = useState(10);
  const generatingRef = useRef(false);
  const limit = 10;

  useEffect(() => {
    const controller = new AbortController();
    setHistoryLoading(true); setHistoryError('');
    getReports({ limit, offset, signal: controller.signal }).then((data) => {
      if (controller.signal.aborted) return;
      setHistory(data);
      if (offset === 0) setHasTodayReport(data.items.some((item) => item.fecha === todayDate));
      setDate((current) => current || data.items[0]?.fecha || '');
    }).catch((failure) => { if (failure.name !== 'AbortError') setHistoryError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setHistoryLoading(false); });
    return () => controller.abort();
  }, [offset, attempt, historyAttempt, todayDate]);

  useEffect(() => {
    if (!date) { setReport(null); return; }
    if (report && report.fecha === date && attempt === 0 && historyAttempt > 0) return;
    const controller = new AbortController();
    setLoading(true); setError(''); setReport(null);
    getReport(date, controller.signal).then((data) => { if (!controller.signal.aborted) setReport(data); })
      .catch((failure) => { if (failure.name !== 'AbortError') setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [date, attempt]);

  async function handleGenerate(actualizar) {
    if (generatingRef.current) return;
    generatingRef.current = true;
    setGenerating(true);
    setGenerateError('');
    setLastActionUpdate(actualizar);
    try {
      const generated = await generateTodayReport({ actualizar });
      setConfirmingUpdate(false);
      setHasTodayReport(true);
      setReport(generated);
      setDate(generated.fecha);
      setOffset(0);
      setHistoryAttempt((n) => n + 1);
    } catch (failure) {
      if (failure.name !== 'AbortError') setGenerateError(failure.message);
    } finally {
      generatingRef.current = false;
      setGenerating(false);
    }
  }

  useEffect(() => {
    setPeopleOffset(0);
  }, [date, personFilter]);

  const data = report?.datos;
  const peopleQuery = personFilter.trim().toLowerCase();
  const peopleItems = (data?.detalle_personas?.items || []).filter((item) => !peopleQuery
    || String(item.nombre || '').toLowerCase().includes(peopleQuery)
    || String(item.departamento || '').toLowerCase().includes(peopleQuery)
    || String(item.puesto || '').toLowerCase().includes(peopleQuery));
  const safePeopleOffset = peopleItems.length
    ? Math.min(peopleOffset, Math.floor((peopleItems.length - 1) / peopleLimit) * peopleLimit)
    : 0;
  const paginatedPeople = peopleItems.slice(safePeopleOffset, safePeopleOffset + peopleLimit);

  return <WorkspaceLayout title="Reportes de RRHH" className="reports-dashboard">
    <span className="section-tag">UNA MIRADA A NUESTRA GENTE</span><div className="report-title-row"><div><h1 className="page-title">Reporte de personas<span className="greeting-dot">.</span></h1>
      <p className="muted page-intro">Información agregada para acompañar mejor al equipo.</p></div>
      <div className="report-actions">
        <span className="role-badge">Solo Recursos Humanos</span>
        {!historyLoading && !hasTodayReport && (
          <button type="button" className="primary-button" disabled={generating} onClick={() => handleGenerate(false)}>
            {generating ? 'Generando reporte de hoy…' : 'Generar reporte de hoy'}
          </button>
        )}
        {!historyLoading && hasTodayReport && (
          <>
            {date !== todayDate && (
              <button type="button" className="secondary-button" disabled={generating} onClick={() => { setOffset(0); setDate(todayDate); }}>
                Abrir reporte de hoy
              </button>
            )}
            <button type="button" className="secondary-button" disabled={generating} onClick={() => { setGenerateError(''); setConfirmingUpdate(true); }}>
              {generating && lastActionUpdate ? 'Actualizando reporte de hoy…' : 'Actualizar reporte de hoy'}
            </button>
          </>
        )}
      </div>
    </div>
    {confirmingUpdate && (
      <div className="report-confirm-box" role="region" aria-label="Confirmar actualización del reporte">
        <p><strong>¿Actualizar el reporte de hoy ({todayDate})?</strong> Se recalcularán los indicadores y el resumen con los datos actuales de Costa Rica sin modificar los reportes de otros días.</p>
        <div className="report-confirm-actions">
          <button type="button" className="primary-button" disabled={generating} onClick={() => handleGenerate(true)}>
            {generating ? 'Actualizando…' : 'Confirmar actualización'}
          </button>
          <button type="button" className="secondary-button" disabled={generating} onClick={() => setConfirmingUpdate(false)}>
            Cancelar
          </button>
        </div>
      </div>
    )}
    {generating && <Loading>{lastActionUpdate ? 'Actualizando el reporte de hoy…' : 'Generando el reporte de hoy…'}</Loading>}
    {generateError && <ErrorMessage onRetry={() => handleGenerate(lastActionUpdate)}>{generateError}</ErrorMessage>}
    <section className="report-history" aria-label="Historial de reportes">
      <label htmlFor="report-date">Fecha del reporte<select id="report-date" value={date} onChange={(event) => setDate(event.target.value)} disabled={historyLoading || !history?.items.length}>
        {!history?.items.length && <option value="">Sin reportes publicados</option>}
        {history?.items.map((item) => <option key={item.id} value={item.fecha}>{item.fecha} · {item.origen === 'fixture' ? 'Simulado' : 'Ejecución'}</option>)}
      </select></label>
      <div className="history-pagination"><button className="page-button" aria-label="Reportes más recientes" disabled={historyLoading || offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>←</button>
        <span>{history ? `${offset + (history.total ? 1 : 0)}–${Math.min(offset + limit, history.total)} de ${history.total}` : 'Cargando…'}</span>
        <button className="page-button" aria-label="Reportes anteriores" disabled={historyLoading || !history || offset + limit >= history.total} onClick={() => setOffset(offset + limit)}>→</button></div>
    </section>
    {historyError && <ErrorMessage onRetry={() => setAttempt((n) => n + 1)}>{historyError}</ErrorMessage>}
    {(historyLoading || loading) && <Loading>Consultando el reporte publicado…</Loading>}
    {error && <ErrorMessage onRetry={() => setAttempt((n) => n + 1)}>{error}</ErrorMessage>}
    {!historyLoading && history?.total === 0 && <div className="empty-state"><h2>Aún no hay reportes publicados</h2><p>Usa «Generar reporte de hoy» para crear el primer reporte del día o espera la ejecución programada de las 7:00 a. m.</p></div>}
    {data && <>
      <p className="report-provenance"><span className={report.origen === 'fixture' ? 'source-fixture' : 'source-execution'}>{report.origen === 'fixture' ? 'Datos simulados · Fixture' : 'Ejecución del analista'}</span>
        <span>{report.fecha} · Corte 07:00 Costa Rica · Versión {report.esquema_version}</span></p>
      <section className="report-metrics" aria-label="Indicadores principales">
        <Metric label="Personas ausentes" number={data.ausencias?.total} detail="Personas distintas en la fecha" />
        <Metric label="Solicitudes pendientes" number={data.solicitudes_pendientes?.total} detail={`${value(data.solicitudes_pendientes?.mas_de_3_dias)} con más de 72 horas`} />
        <Metric label="Incapacidades activas" number={data.incapacidades?.activas} detail={`${value(data.incapacidades?.dias_acumulados_mes)} días acumulados en el mes`} />
        <Metric label="Riesgo de vacaciones" number={data.riesgo_vacaciones?.total_colaboradores} detail={`Más de ${value(data.riesgo_vacaciones?.umbral_dias)} días disponibles`} />
      </section>
      <section className="executive-summary report-card"><span className="section-tag">RESUMEN EJECUTIVO</span><h2>Lo que nos dice el día</h2><p>{report.resumen_texto}</p>
        {report.origen === 'fixture' && <small>Resumen precargado de demostración; no acredita ejecución del LLM.</small>}</section>
      <div className="report-chart-grid"><TrendChart items={data.uso_chatbot?.tendencia_30_dias} /><DepartmentChart items={data.riesgo_vacaciones?.por_departamento} /></div>
      <section className="report-card"><h2>Solicitudes que necesitan seguimiento</h2><p className="muted">Detalle operativo visible únicamente para RRHH, sin salarios.</p>
        {data.solicitudes_pendientes?.items?.length ? <div className="table-wrap"><table className="report-table"><caption className="sr-only">Solicitudes pendientes</caption><thead><tr><th>ID</th><th>Colaborador</th><th>Tipo</th><th>Área</th><th>Desde</th><th>Hasta</th><th>Días pendientes</th></tr></thead>
          <tbody>{data.solicitudes_pendientes.items.map((item) => <tr key={item.id}><th scope="row">{item.id}</th><td>{item.nombre || '—'}</td><td>{item.tipo}</td><td>{item.departamento}</td><td>{item.fecha_inicio}</td><td>{item.fecha_fin}</td><td>{item.dias_pendiente}</td></tr>)}</tbody></table></div> : <p className="empty-inline">No hay solicitudes pendientes registradas.</p>}</section>
      <div className="report-detail-grid">
        <section className="report-card"><h2>Ausencias por tipo</h2><dl className="stat-list">{Object.entries(data.ausencias?.por_tipo || {}).map(([type, total]) => <div key={type}><dt>{type}</dt><dd>{value(total)}</dd></div>)}</dl><p className="data-note">Una persona puede aparecer en más de un tipo; el total cuenta personas distintas.</p>
          <details><summary>Ausencias por departamento</summary>{data.ausencias?.por_departamento === null ? <p>Sin datos confiables.</p> : <div className="table-wrap"><table><caption className="sr-only">Ausencias por departamento y tipo</caption><thead><tr><th>Área</th><th>Total</th><th>Vacaciones</th><th>Permisos</th><th>Incapacidad</th></tr></thead><tbody>{(data.ausencias?.por_departamento || []).map((item) => <tr key={item.departamento}><th scope="row">{item.departamento}</th><td>{value(item.total)}</td><td>{value(item.por_tipo?.vacaciones)}</td><td>{value(item.por_tipo?.permiso)}</td><td>{value(item.por_tipo?.incapacidad)}</td></tr>)}</tbody></table></div>}</details></section>
        <section className="report-card"><h2>Movimientos de personal</h2><dl className="stat-list"><div><dt>Ingresos del mes</dt><dd>{value(data.movimientos_personal?.ingresos_mes)}</dd></div>
          <div><dt>Salidas del mes</dt><dd>{value(data.movimientos_personal?.salidas_mes)}</dd></div><div><dt>Rotación acumulada</dt><dd>{value(data.movimientos_personal?.rotacion_acumulada_pct, ' %')}</dd></div>
          <div><dt>Dotación inicial / al corte</dt><dd>{value(data.movimientos_personal?.dotacion_inicio_mes)} / {value(data.movimientos_personal?.dotacion_corte)}</dd></div></dl>
          <details><summary>Ver definición</summary><p className="formula-note">{data.movimientos_personal?.formula}</p></details></section>
        <section className="report-card"><h2>Uso del asistente</h2><dl className="stat-list"><div><dt>Consultas del día anterior</dt><dd>{value(data.uso_chatbot?.consultas_dia_anterior)}</dd></div>
          <div><dt>Resueltas sin escalar</dt><dd>{value(data.uso_chatbot?.resueltas_sin_escalar_pct, ' %')}</dd></div><div><dt>Latencia media</dt><dd>{value(data.uso_chatbot?.latencia_promedio_ms, ' ms')}</dd></div></dl></section>
        <section className="report-card"><h2>Temas más consultados</h2>{data.temas_chatbot?.top_5?.length ? <ol className="topic-list">{data.temas_chatbot.top_5.map((item) => <li key={item.tema}><span>{item.tema}</span><strong>{item.consultas}</strong></li>)}</ol> : <p className="empty-inline">No hay temas registrados en esta ventana.</p>}
          <details><summary>Preguntas sin respuesta</summary>{data.temas_chatbot?.sin_respuesta?.length ? <ul className="unanswered-list">{data.temas_chatbot.sin_respuesta.map((item, index) => <li key={index}>{item.pregunta} <span>({item.consultas})</span></li>)}</ul> : <p className="empty-inline">Sin preguntas pendientes en esta ventana.</p>}</details></section>
      </div>
      <details className="report-card"><summary>Detalle de riesgo de vacaciones</summary><p className="data-note">Identificadores operativos visibles únicamente para RRHH.</p>
        <div className="table-wrap"><table className="report-table"><caption className="sr-only">Colaboradores con riesgo de vacaciones</caption><thead><tr><th>ID colaborador</th><th>Colaborador</th><th>Área</th><th>Días disponibles</th></tr></thead><tbody>{data.riesgo_vacaciones?.items?.map((item) => <tr key={item.colaborador_id}><th scope="row">{item.colaborador_id}</th><td>{item.nombre ? <Link to={`/rrhh/colaboradores/${item.colaborador_id}`} className="person-link">{item.nombre}</Link> : '—'}</td><td>{item.departamento}</td><td>{String(item.dias_disponibles).replace('.', ',')}</td></tr>)}</tbody></table></div></details>
      <section id="reporte-por-persona" className="report-card" aria-label="Reporte por persona">
        <div className="report-people-header">
          <div>
            <h2>Reporte por persona ({data.detalle_personas?.total ?? 0})</h2>
            <p className="muted">Estado operativo de cada colaborador en la fecha del reporte. Haz clic en cualquier nombre para abrir su ficha individual.</p>
          </div>
          {data.detalle_personas?.items?.length > 0 && (
            <label className="report-people-filter" htmlFor="report-people-filter">
              <span className="sr-only">Buscar colaborador</span>
              <input id="report-people-filter" type="search" placeholder="Filtrar por nombre, área o puesto…" value={personFilter} onChange={(event) => setPersonFilter(event.target.value)} />
            </label>
          )}
        </div>
        {data.detalle_personas?.items?.length ? (
          peopleItems.length ? (
            <>
              <div className="table-wrap"><table className="report-table"><caption className="sr-only">Reporte individual de colaboradores</caption><thead><tr><th>ID</th><th>Colaborador</th><th>Área</th><th>Puesto</th><th>Estado</th><th>Vacaciones disp.</th><th>Pendientes</th><th>Incapacidad</th><th>Ausente hoy</th></tr></thead>
                <tbody>{paginatedPeople.map((item) => <tr key={item.colaborador_id}><th scope="row">{item.colaborador_id}</th><td><Link to={`/rrhh/colaboradores/${item.colaborador_id}`} className="person-link">{item.nombre}</Link></td><td>{item.departamento}</td><td>{item.puesto}</td><td>{item.estado}</td><td>{String(item.dias_vacaciones_disponibles).replace('.', ',')}</td><td>{item.solicitudes_pendientes}</td><td>{item.incapacidades_activas}</td><td>{item.ausente_hoy ? 'Sí' : 'No'}</td></tr>)}</tbody></table></div>
              <Pagination
                total={peopleItems.length}
                limit={peopleLimit}
                offset={safePeopleOffset}
                onPage={setPeopleOffset}
                onLimit={(nextLimit) => {
                  setPeopleLimit(nextLimit);
                  setPeopleOffset(0);
                }}
                itemLabel="Personas por página"
                emptyLabel="0 personas"
                ariaLabel="Paginación de reporte por persona"
                options={[10, 20, 30, 60]}
              />
            </>
          ) : <p className="empty-inline">Ningún colaborador coincide con el filtro ingresado.</p>
        ) : <p className="empty-inline">Este reporte histórico no incluye el desglose individual por persona.</p>}
      </section>
    </>}
    <MonthlyReportsSection />
  </WorkspaceLayout>;
}
