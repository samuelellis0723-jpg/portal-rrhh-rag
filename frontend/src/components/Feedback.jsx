export function Loading({ children = 'Cargando tu espacio…' }) {
  return <div className="loading" role="status"><span className="spinner" aria-hidden="true" />{children}</div>;
}

export function ErrorMessage({ children, onRetry }) {
  return <div className="error-box" role="alert"><p>{children}</p>
    {onRetry && <button className="text-button" onClick={onRetry}>Volver a intentar</button>}
  </div>;
}
