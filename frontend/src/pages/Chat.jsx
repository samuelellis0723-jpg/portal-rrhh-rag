import { useEffect, useRef, useState } from 'react';
import WorkspaceLayout from '../components/WorkspaceLayout';
import ChatMessage from '../components/ChatMessage';
import { ErrorMessage, Loading } from '../components/Feedback';
import { useSession } from '../components/SessionProvider';
import { getChatHistory, sendMessage } from '../services/chat';

const sortHistory = (items) => [...items].sort((a, b) => (a.consulta_id || Number.MAX_SAFE_INTEGER) - (b.consulta_id || Number.MAX_SAFE_INTEGER));

export default function Chat() {
  const { session } = useSession();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottom = useRef(null);
  const mounted = useRef(true);
  const sequence = useRef(0);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    setLoading(true);
    setHistoryError('');
    getChatHistory({ signal: controller.signal }).then((data) => {
      if (controller.signal.aborted) return;
      setItems(sortHistory(data.items)); setLoaded(data.items.length); setTotal(data.total);
    }).catch((error) => { if (error.name !== 'AbortError') setHistoryError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); mounted.current = false; };
  }, [session.usuario.id, attempt]);

  useEffect(() => { if (sending) bottom.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' }); }, [sending]);

  async function loadMore() {
    setMoreLoading(true); setHistoryError('');
    try {
      const data = await getChatHistory({ offset: loaded });
      if (!mounted.current) return;
      setItems((previous) => sortHistory([...new Map([...data.items, ...previous].map((item) => [item.consulta_id || item.localId, item])).values()]));
      setLoaded((value) => value + data.items.length); setTotal(data.total);
    } catch (error) { if (mounted.current) setHistoryError(error.message); }
    finally { if (mounted.current) setMoreLoading(false); }
  }

  async function submit(event) {
    event?.preventDefault();
    const mensaje = draft.trim();
    if (!mensaje || sending || loading || mensaje.length > 4000) return;
    const localId = `pending-${++sequence.current}`;
    setItems((previous) => [...previous, { localId, mensaje, pending: true }]);
    setDraft(''); setSending(true);
    try {
      const data = await sendMessage(mensaje);
      if (!mounted.current) return;
      setItems((previous) => previous.map((item) => item.localId === localId ? { ...data, mensaje } : item));
      setTotal((value) => value + 1); setLoaded((value) => value + 1);
    } catch (error) {
      if (mounted.current) setItems((previous) => previous.map((item) => item.localId === localId ? { localId, mensaje, error: error.message } : item));
    } finally { if (mounted.current) setSending(false); }
  }

  return <WorkspaceLayout title="Asistente de RRHH" className="chat-dashboard">
    <div className="section-tag">CONVERSEMOS CON CLARIDAD</div><h1 className="page-title">Tu asistente de RRHH<span className="greeting-dot">.</span></h1>
    <p className="muted page-intro">Pregunta por las políticas o tu información. Cada fuente conserva su procedencia.</p>
    <div className="chat-panel">
      {loading ? <Loading>Recuperando tu conversación…</Loading> : <>
        {loaded < total && <button className="history-button" onClick={loadMore} disabled={moreLoading || sending}>{moreLoading ? 'Cargando…' : 'Ver consultas anteriores'}</button>}
        {historyError && <ErrorMessage onRetry={() => setAttempt((value) => value + 1)}>{historyError}</ErrorMessage>}
        {!items.length && !historyError && <div className="chat-welcome"><span aria-hidden="true">◌</span><h2>¿En qué te ayudamos hoy?</h2>
          <p>Tu saldo de vacaciones, un permiso o cómo funciona una política. Tus consultas y datos se mantienen en tu cuenta.</p>
          <div className="suggested-questions">{['¿Cuántos días de vacaciones me quedan?', '¿Cómo solicito vacaciones?', '¿Cuándo es mi próximo pago?'].map((question) => <button key={question} onClick={() => setDraft(question)}>{question}</button>)}</div></div>}
        <div className="chat-messages">{items.map((item) => <ChatMessage key={item.consulta_id || item.localId} item={item} onRetry={setDraft} />)}<div ref={bottom} /></div>
      </>}
      <form className="chat-composer" onSubmit={submit} aria-busy={sending}>
        <label htmlFor="chat-message">Escribe tu consulta</label>
        <textarea id="chat-message" value={draft} maxLength={4000} rows={3} disabled={sending || loading} placeholder="Por ejemplo: ¿cuántos días de vacaciones tengo disponibles?"
          onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); }
          }} aria-describedby="chat-help" />
        <div className="composer-actions"><span id="chat-help">{draft.length}/4000 · Shift + Enter para una nueva línea</span>
          <button className="primary-button" type="submit" disabled={!draft.trim() || sending || loading}>{sending ? 'Consultando…' : 'Enviar consulta'}<span aria-hidden="true">↑</span></button></div>
      </form>
    </div>
    <p className="data-note">Las políticas académicas no sustituyen asesoría para un caso particular. Evita incluir diagnósticos o documentos personales en el chat.</p>
  </WorkspaceLayout>;
}
