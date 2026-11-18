import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import Brand from './Brand';
import { ErrorMessage } from './Feedback';
import { useSession } from './SessionProvider';

export default function WorkspaceLayout({ title = 'Mi espacio', children, className = '' }) {
  const { session, signOut } = useSession();
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState('');
  async function leave() {
    setLeaving(true);
    setError('');
    try { await signOut(); }
    catch (failure) { setError(failure.message); setLeaving(false); }
  }
  return <div className="workspace">
    <a className="skip-link" href="#contenido">Saltar al contenido</a>
    <aside className="sidebar"><Brand />
      <nav className="sidebar-nav" aria-label="Portal"><span className="nav-label">MI PORTAL</span>
        <NavLink to="/mi-espacio"><span aria-hidden="true">◫</span> Mi espacio</NavLink>
        <NavLink to="/chat"><span aria-hidden="true">◌</span> Asistente de RRHH</NavLink>
        {session.colaborador.rol === 'rrhh' && <NavLink to="/rrhh/reportes"><span aria-hidden="true">▥</span> Reportes</NavLink>}
      </nav>
      <div className="sidebar-bottom"><p>Un buen descanso<br /><strong>también es crecer.</strong></p><span>HECHO PARA NUESTRA GENTE</span></div>
    </aside>
    <div className="workspace-body">
      <header className="topbar"><span>Portal de personas <span className="breadcrumb-divider">/</span> <strong>{title}</strong></span>
        <button className="logout-button" onClick={leave} disabled={leaving}>{leaving ? 'Cerrando sesión…' : 'Cerrar sesión'}<span aria-hidden="true">↗</span></button>
      </header>
      <main id="contenido" className={`dashboard ${className}`}>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        {children}
        <footer className="dashboard-footer"><span>Bosque Claro · Costa Rica</span><span>Entorno de demostración · Datos simulados</span></footer>
      </main>
    </div>
  </div>;
}
