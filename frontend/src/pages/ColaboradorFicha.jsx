import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import WorkspaceLayout from '../components/WorkspaceLayout';
import { ErrorMessage, Loading } from '../components/Feedback';
import { getCollaboratorProfile } from '../services/reportes';

const STATUS_LABELS = {
  puntual: 'Puntual',
  tardia: 'Tardía',
  falta: 'Falta',
  vacaciones: 'Vacaciones',
  permiso: 'Permiso',
  incapacidad: 'Incapacidad',
  dia_libre: 'Día libre',
  sin_registro: 'Sin registro',
};

export default function ColaboradorFicha() {
  const { id } = useParams();
  const [mes, setMes] = useState('2026-10');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setMes('2026-10');
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    getCollaboratorProfile(id, { mes, signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) setProfile(data);
    }).catch((failure) => {
      if (failure.name !== 'AbortError') setError(failure.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [id, mes, attempt]);

  return (
    <WorkspaceLayout title="Ficha del colaborador" className="reports-dashboard">
      <div className="ficha-nav">
        <Link to="/rrhh/reportes#reporte-por-persona" className="back-link">← Volver a la tabla de personas</Link>
        <span className="role-badge">Solo Recursos Humanos</span>
      </div>

      {loading && <Loading>Cargando ficha del colaborador…</Loading>}
      {error && <ErrorMessage onRetry={() => setAttempt((n) => n + 1)}>{error}</ErrorMessage>}

      {!loading && profile && (
        <>
          <span className="section-tag">FICHA INDIVIDUAL · ID {profile.colaborador.id}</span>
          <div className="report-title-row">
            <div>
              <h1 className="page-title">{profile.colaborador.nombre}<span className="greeting-dot">.</span></h1>
              <p className="muted page-intro">
                {profile.colaborador.puesto} · {profile.colaborador.departamento} · Estado: {profile.colaborador.estado} · Ingreso: {profile.colaborador.fecha_ingreso}
                {profile.colaborador.fecha_salida ? ` · Salida: ${profile.colaborador.fecha_salida}` : ''}
              </p>
            </div>
          </div>

          <section className="report-history" aria-label="Selector de mes de la ficha">
            <div>
              <strong>Período consultado:</strong> {profile.periodo.etiqueta} ({profile.periodo.fecha_inicio} al {profile.periodo.fecha_fin} · {profile.periodo.zona_horaria})
            </div>
            <div className="month-tabs" role="tablist" aria-label="Cambiar mes de la ficha">
              {profile.meses_disponibles.map((item) => (
                <button
                  key={item.mes}
                  type="button"
                  role="tab"
                  aria-selected={mes === item.mes}
                  className={`month-tab${mes === item.mes ? ' active' : ''}`}
                  onClick={() => setMes(item.mes)}
                >
                  {item.etiqueta}
                </button>
              ))}
            </div>
          </section>

          <section className="report-metrics" aria-label="Resumen de asistencia del período">
            <div className="report-metric">
              <span>Días programados</span>
              <strong>{profile.resumen.dias_programados}</strong>
              <p>Días libres: {profile.resumen.dias_libres} · Sin registro: {profile.resumen.sin_registro}</p>
            </div>
            <div className="report-metric">
              <span>Días trabajados</span>
              <strong>{profile.resumen.dias_trabajados}</strong>
              <p>Puntuales: {profile.resumen.dias_puntuales} · Tardías: {profile.resumen.tardias} (cuentan como día trabajado)</p>
            </div>
            <div className="report-metric">
              <span>Faltas y tardías</span>
              <strong>{profile.resumen.faltas} / {profile.resumen.tardias}</strong>
              <p>Minutos acumulados de tardía: {profile.resumen.minutos_tardia_total} min</p>
            </div>
            <div className="report-metric">
              <span>Ausencias justificadas</span>
              <strong>{profile.resumen.ausencias_justificadas.total}</strong>
              <p>Vacaciones: {profile.resumen.ausencias_justificadas.vacaciones} · Permisos: {profile.resumen.ausencias_justificadas.permiso} · Incapacidad: {profile.resumen.ausencias_justificadas.incapacidad}</p>
            </div>
          </section>

          <section className="report-card" aria-label="Registro diario de asistencia">
            <h2>Registro diario ({profile.periodo.fecha_inicio} al {profile.periodo.fecha_fin})</h2>
            <p className="muted">Jornada programada en zona horaria {profile.periodo.zona_horaria}. Sin salarios, diagnósticos médicos ni conversaciones privadas.</p>
            {profile.registro_diario.length ? (
              <div className="table-wrap">
                <table className="report-table">
                  <caption className="sr-only">Registro diario de asistencia</caption>
                  <thead><tr><th>Fecha</th><th>Estado</th><th>Hora programada</th><th>Hora de entrada</th><th>Minutos de tardía</th></tr></thead>
                  <tbody>
                    {profile.registro_diario.map((day) => (
                      <tr key={day.fecha}>
                        <th scope="row">{day.fecha}</th>
                        <td><span className={`status-pill status-${day.estado}`}>{STATUS_LABELS[day.estado] || day.estado}</span></td>
                        <td>{day.hora_entrada_programada || '—'}</td>
                        <td>{day.hora_entrada_real || '—'}</td>
                        <td>{day.estado === 'tardia' ? `${day.minutos_tardia} min` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="empty-inline">Sin días laborales dentro de la vigencia de empleo en este período.</p>}
          </section>

          <div className="report-detail-grid">
            <section className="report-card" aria-label="Solicitudes del período">
              <h2>Solicitudes del período ({profile.solicitudes.length})</h2>
              {profile.solicitudes.length ? (
                <div className="table-wrap">
                  <table className="report-table">
                    <caption className="sr-only">Solicitudes del período</caption>
                    <thead><tr><th>ID</th><th>Tipo</th><th>Desde</th><th>Hasta</th><th>Días en mes</th><th>Estado</th></tr></thead>
                    <tbody>
                      {profile.solicitudes.map((req) => (
                        <tr key={req.id}>
                          <th scope="row">{req.id}</th>
                          <td>{req.tipo}</td>
                          <td>{req.fecha_inicio}</td>
                          <td>{req.fecha_fin}</td>
                          <td>{req.dias_en_periodo}</td>
                          <td>{req.estado}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="empty-inline">No hay solicitudes registradas en este mes.</p>}
            </section>

            <section className="report-card" aria-label="Movimientos de personal del período">
              <h2>Movimientos de personal ({profile.movimientos_personal.length})</h2>
              {profile.movimientos_personal.length ? (
                <div className="table-wrap">
                  <table className="report-table">
                    <caption className="sr-only">Movimientos de personal del período</caption>
                    <thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th></tr></thead>
                    <tbody>
                      {profile.movimientos_personal.map((mov) => (
                        <tr key={mov.id}>
                          <th scope="row">{mov.fecha}</th>
                          <td>{mov.tipo}</td>
                          <td>{mov.detalle || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="empty-inline">No hubo movimientos de personal en este mes.</p>}
            </section>
          </div>
        </>
      )}
    </WorkspaceLayout>
  );
}
