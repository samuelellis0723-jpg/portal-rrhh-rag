import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorMessage, Loading } from './Feedback';
import { getMonthlyReport, getMonthlyReports } from '../services/reportes';

const fmt = (n, suffix = '') => n === null || n === undefined ? 'Sin datos' : `${n}${suffix}`;

export default function MonthlyReportsSection() {
  const [months, setMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getMonthlyReports(controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      setMonths(data.items || []);
      setSelectedMonth((current) => current || data.mes_por_defecto || data.items?.[0]?.mes || '');
    }).catch((failure) => {
      if (failure.name !== 'AbortError') setError(failure.message);
    });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    if (!selectedMonth) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    getMonthlyReport(selectedMonth, controller.signal).then((data) => {
      if (!controller.signal.aborted) setReport(data);
    }).catch((failure) => {
      if (failure.name !== 'AbortError') setError(failure.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [selectedMonth, attempt]);

  return (
    <section className="report-card monthly-reports" aria-label="Reportes mensuales">
      <div className="monthly-header">
        <div>
          <span className="section-tag">CONSOLIDADO POR MES COMPLETO</span>
          <h2>Reportes mensuales</h2>
          <p className="muted">Tres reportes generales consecutivos calculados desde MySQL (asistencia simulada, solicitudes, incapacidades y movimientos).</p>
        </div>
        <div className="month-tabs" role="tablist" aria-label="Meses disponibles">
          {months.map((item) => (
            <button
              key={item.mes}
              type="button"
              role="tab"
              aria-selected={selectedMonth === item.mes}
              className={`month-tab${selectedMonth === item.mes ? ' active' : ''}`}
              onClick={() => setSelectedMonth(item.mes)}
            >
              {item.etiqueta}
            </button>
          ))}
        </div>
      </div>

      {loading && <Loading>Cargando reporte mensual…</Loading>}
      {error && <ErrorMessage onRetry={() => setAttempt((n) => n + 1)}>{error}</ErrorMessage>}

      {!loading && report && (
        <div className="monthly-content">
          <p className="report-provenance">
            <span className="source-fixture">Registros simulados · MySQL</span>
            <span>Período: <strong>{report.fecha_inicio}</strong> al <strong>{report.fecha_fin}</strong> · {report.zona_horaria} · {report.colaboradores_con_registro} personas con registro</span>
          </p>

          <div className="report-metrics">
            <div className="report-metric">
              <span>Días trabajados / programados</span>
              <strong>{report.asistencia.dias_trabajados}</strong>
              <p>De {report.asistencia.dias_programados} programados · Asistencia: {fmt(report.asistencia.porcentaje_asistencia, ' %')}</p>
            </div>
            <div className="report-metric">
              <span>Tardías</span>
              <strong>{report.asistencia.tardias}</strong>
              <p>Puntualidad: {fmt(report.asistencia.porcentaje_puntualidad, ' %')} · Promedio {report.asistencia.promedio_minutos_tardia} min</p>
            </div>
            <div className="report-metric">
              <span>Faltas</span>
              <strong>{report.asistencia.faltas}</strong>
              <p>Sin registro: {report.asistencia.sin_registro} · Días libres: {report.asistencia.dias_libres}</p>
            </div>
            <div className="report-metric">
              <span>Ausencias justificadas (días)</span>
              <strong>{report.asistencia.ausencias_justificadas.total}</strong>
              <p>Vac: {report.asistencia.ausencias_justificadas.vacaciones} · Perm: {report.asistencia.ausencias_justificadas.permiso} · Incap: {report.asistencia.ausencias_justificadas.incapacidad}</p>
            </div>
          </div>

          <p className="formula-note">
            <strong>Cálculo de porcentajes:</strong> Asistencia = <code>{report.asistencia.formula_porcentaje_asistencia}</code>. Puntualidad = <code>{report.asistencia.formula_porcentaje_puntualidad}</code>.
          </p>

          <div className="report-detail-grid">
            <div className="report-card">
              <h3>Solicitudes del mes</h3>
              <dl className="stat-list">
                <div><dt>Total solicitudes</dt><dd>{report.solicitudes.total}</dd></div>
                <div><dt>Aprobadas / Pendientes / Rechazadas</dt><dd>{report.solicitudes.por_estado.aprobada} / {report.solicitudes.por_estado.pendiente} / {report.solicitudes.por_estado.rechazada}</dd></div>
                <div><dt>Por tipo (vacaciones / permiso)</dt><dd>{report.solicitudes.por_tipo.vacaciones} / {report.solicitudes.por_tipo.permiso}</dd></div>
                <div><dt>Días de solicitud dentro del mes</dt><dd>{report.solicitudes.dias_solicitados_en_mes}</dd></div>
              </dl>
              <p className="data-note">{report.solicitudes.nota_conteo}</p>
            </div>

            <div className="report-card">
              <h3>Incapacidades y movimientos de personal</h3>
              <dl className="stat-list">
                <div><dt>Incapacidades (registros / días en el mes)</dt><dd>{report.incapacidades.total_registros} / {report.incapacidades.dias_en_mes}</dd></div>
                <div><dt>Movimientos de personal</dt><dd>{report.movimientos_personal.total}</dd></div>
                <div><dt>Ingresos / Salidas / Ascensos</dt><dd>{report.movimientos_personal.ingresos} / {report.movimientos_personal.salidas} / {report.movimientos_personal.ascensos}</dd></div>
              </dl>
              <p className="data-note">{report.incapacidades.nota_conteo}</p>
            </div>
          </div>

          {report.movimientos_personal.items.length > 0 && (
            <details className="report-card">
              <summary>Movimientos de personal en {report.etiqueta} ({report.movimientos_personal.total})</summary>
              <div className="table-wrap">
                <table className="report-table">
                  <caption className="sr-only">Movimientos de personal del mes</caption>
                  <thead><tr><th>Fecha</th><th>Colaborador</th><th>Área</th><th>Tipo</th><th>Detalle</th></tr></thead>
                  <tbody>
                    {report.movimientos_personal.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.fecha}</td>
                        <td><Link to={`/rrhh/colaboradores/${item.colaborador_id}`} className="person-link">{item.nombre}</Link></td>
                        <td>{item.departamento}</td>
                        <td>{item.tipo}</td>
                        <td>{item.detalle || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
