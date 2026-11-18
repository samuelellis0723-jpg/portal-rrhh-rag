export default function Pagination({ total, limit, offset, onPage, onLimit, disabled }) {
  return <div className="pagination">
    <label>Períodos por página <select value={limit} onChange={(e) => onLimit(Number(e.target.value))} disabled={disabled}>
      {[5, 10, 20].map((size) => <option key={size} value={size}>{size}</option>)}
    </select></label>
    <span className="page-summary">{total ? `${offset + 1}–${Math.min(offset + limit, total)} de ${total}` : '0 períodos'}</span>
    <nav aria-label="Paginación de períodos">
      <button className="page-button" onClick={() => onPage(Math.max(0, offset - limit))} disabled={disabled || offset === 0} aria-label="Página anterior">←</button>
      <button className="page-button" onClick={() => onPage(offset + limit)} disabled={disabled || offset + limit >= total} aria-label="Página siguiente">→</button>
    </nav>
  </div>;
}
