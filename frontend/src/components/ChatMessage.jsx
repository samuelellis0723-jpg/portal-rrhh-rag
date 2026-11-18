function driveLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['docs.google.com', 'drive.google.com'].includes(url.hostname) ? url.href : null;
  } catch { return null; }
}

export default function ChatMessage({ item, onRetry }) {
  const labels = { politica: 'Documentos', dato_personal: 'Mi información', mixta: 'Documentos y mi información', reporte: 'Reporte de RRHH' };
  return <article className="chat-turn" aria-label="Consulta y respuesta">
    <div className="chat-question"><span className="message-author">Tú</span><p>{item.mensaje}</p></div>
    <div className={`chat-answer ${item.error ? 'chat-answer-error' : ''}`}>
      <div className="answer-header"><strong>Asistente de RRHH</strong><span>{labels[item.intencion] || 'Bosque Claro'}</span></div>
      {item.pending ? <p role="status" className="answer-pending">Consultando las fuentes disponibles…</p>
        : item.error ? <div role="alert"><p>{item.error}</p><button className="text-button" onClick={() => onRetry(item.mensaje)}>Volver a intentar</button></div>
          : <><p className="answer-text">{item.respuesta}</p>
            {item.estado === 'parcial' && <p className="answer-note">Respuesta parcial: una de las fuentes no está disponible.</p>}
            {item.dato_personal?.dias_disponibles !== undefined && <div className="personal-result"><span>Saldo disponible</span>
              <strong>{String(item.dato_personal.dias_disponibles).replace('.', ',')} días</strong>
              {item.dato_personal.fecha_corte && <small>Al {item.dato_personal.fecha_corte}</small>}</div>}
            {item.citas?.length > 0 && <section className="citation-list" aria-label="Fuentes de la respuesta">
              <h3>Fuentes consultadas</h3>{item.citas.map((citation, index) => {
                const href = driveLink(citation.enlace);
                return <div className="citation" key={`${citation.fragmento_id || citation.drive_file_id}-${index}`}>
                  <span className="citation-number">{index + 1}</span><div>
                    {href ? <a href={href} target="_blank" rel="noopener noreferrer">{citation.documento} <span aria-hidden="true">↗</span></a> : <strong>{citation.documento}</strong>}
                    <p>{citation.seccion} · Versión {citation.version}</p>
                    {citation.fragmento && <details><summary>Ver fragmento</summary><p>{citation.fragmento}</p></details>}
                  </div></div>;
              })}</section>}
            {item.escalada && <p className="answer-note">Puedes consultar a Recursos Humanos para revisar tu caso. Este aviso no crea un ticket.</p>}
          </>}
    </div>
  </article>;
}
