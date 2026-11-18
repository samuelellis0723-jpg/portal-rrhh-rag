import { useEffect, useState } from 'react';
import WorkspaceLayout from '../components/WorkspaceLayout';
import { ErrorMessage, Loading } from '../components/Feedback';
import Pagination from '../components/Pagination';
import VacacionesTable, { days } from '../components/VacacionesTable';
import { useSession } from '../components/SessionProvider';
import { getVacaciones } from '../services/vacaciones';

export default function MiEspacio() {
  const { session } = useSession();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(5);
  const [offset, setOffset] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const person = session.colaborador;
  const role = person.rol === 'rrhh' ? 'Recursos Humanos' : 'Colaborador';

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    getVacaciones({ limit, offset, signal: controller.signal }).then((result) => {
      if (!controller.signal.aborted) setData(result);
    }).catch((failure) => {
      if (failure.name !== 'AbortError') { setError(failure.message); setData(null); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [limit, offset, attempt]);

  return <WorkspaceLayout>
        <div className="greeting"><div><span className="section-tag">TU DÍA, CON MÁS CLARIDAD</span><h1>Hola, {person.nombre.split(' ')[0]}<span className="greeting-dot">.</span></h1>
          <p className="muted">Este es tu espacio. Aquí puedes consultar tus vacaciones.</p></div><span className="private-badge"><span aria-hidden="true">●</span> Información personal</span></div>
        <section className="profile-strip" aria-label="Tu perfil"><span className="avatar" aria-hidden="true">{person.nombre.slice(0, 1)}</span>
          <div><strong>{person.nombre}</strong><span>{session.usuario.email}</span></div><span className="role-badge">{role}</span></section>
        <section className="vacation-section" aria-labelledby="vacation-title">
          <div className="section-heading"><h2 id="vacation-title">Mis vacaciones</h2><span>Tiempo para ti</span></div>
          <div className="balance-card"><div><span className="balance-label">SALDO TOTAL DISPONIBLE</span>
            <div className="balance-value" aria-live="polite">{data && !error ? <><strong data-testid="total-balance">{days(data.total_dias_disponibles)}</strong><span>días</span></> : <span>{loading ? 'Consultando…' : 'No disponible'}</span>}</div>
            <p>La suma de tus días disponibles en todos los períodos.</p></div>
            <div className="rest-symbol" aria-hidden="true"><span>☀</span><i /><i /></div>
          </div>
          <div className="periods-card"><div className="periods-heading"><div><h3>Detalle por período</h3><p>Así se distribuyen tus días de descanso.</p></div><span className="section-tag">EN DÍAS</span></div>
            <div aria-busy={loading}>
              {loading ? <Loading>Consultando tus períodos…</Loading> : error ? <ErrorMessage onRetry={() => setAttempt((n) => n + 1)}>{error}</ErrorMessage> : data && <>
                <VacacionesTable items={data.items} />
                <Pagination total={data.total} limit={limit} offset={offset} onPage={setOffset}
                  onLimit={(size) => { setLimit(size); setOffset(0); }} disabled={loading} />
              </>}
            </div>
          </div>
          <p className="data-note"><span aria-hidden="true">ⓘ</span> Esta información corresponde únicamente a tu cuenta. Para consultas, comunícate con RRHH.</p>
        </section>
  </WorkspaceLayout>;
}
