import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import Brand from '../components/Brand';
import { ErrorMessage } from '../components/Feedback';
import { useSession } from '../components/SessionProvider';

export default function Login() {
  const { session, notice, signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (session) return <Navigate to="/mi-espacio" replace />;

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try { await signIn(email.trim().toLowerCase(), password); }
    catch (failure) { setError(failure.message); setPassword(''); }
    finally { setBusy(false); }
  }

  return <main className="login-layout">
    <section className="login-intro" aria-label="Bosque Claro"><Brand />
      <div className="intro-copy"><span className="eyebrow">CRECEMOS CONTIGO</span>
        <h1>Un espacio para<br />estar al día.<span>Y estar bien.</span></h1>
        <p>Tu información, en un solo lugar.<br />Consulta tus vacaciones y dale espacio a tu próximo descanso.</p>
        <div className="intro-decoration" aria-hidden="true"><span /><span /><span /></div>
      </div>
      <p className="intro-footer">Bosque Claro Servicios Digitales S.A.<span>Costa Rica</span></p>
    </section>
    <section className="login-panel" aria-labelledby="login-title"><div className="login-form-wrap">
      <span className="section-tag">PORTAL DE PERSONAS</span>
      <h2 id="login-title">Qué bueno verte.</h2><p className="muted">Ingresa con tu cuenta para entrar a tu espacio.</p>
      {notice && <p className="notice" role="status">{notice}</p>}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <form onSubmit={submit} aria-busy={busy}>
        <label htmlFor="email">Correo electrónico</label>
        <input id="email" name="email" type="email" autoComplete="username" required maxLength={254}
          value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu.correo@empresa.example" disabled={busy} />
        <label htmlFor="password">Contraseña</label>
        <div className="password-input"><input id="password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password"
          required maxLength={256} value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
          <button type="button" className="password-toggle" onClick={() => setVisible((value) => !value)} aria-pressed={visible}
            aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} disabled={busy}>{visible ? 'Ocultar' : 'Mostrar'}</button>
        </div>
        <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Ingresando…' : 'Entrar a mi espacio'}<span aria-hidden="true">→</span></button>
      </form>
      <p className="login-help">¿Necesitas ayuda para ingresar?<br />Comunícate con Recursos Humanos.</p>
      <p className="demo-note"><span aria-hidden="true">◈</span> Entorno de demostración · Datos simulados</p>
    </div></section>
  </main>;
}
