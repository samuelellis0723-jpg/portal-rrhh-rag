export default function Pagination({
  total,
  limit,
  offset,
  onPage,
  onLimit,
  disabled,
  itemLabel = 'Períodos por página',
  emptyLabel = '0 períodos',
  ariaLabel = 'Paginación de períodos',
  options = [5, 10, 20],
}) {
  const currentPage = total ? Math.floor(offset / limit) + 1 : 0;
  const totalPages = total ? Math.ceil(total / limit) : 0;

  return <div className="pagination">
    <label>{itemLabel} <select value={limit} onChange={(e) => onLimit(Number(e.target.value))} disabled={disabled}>
      {options.map((size) => <option key={size} value={size}>{size}</option>)}
    </select></label>
    <span className="page-summary">
      {total ? `${offset + 1}–${Math.min(offset + limit, total)} de ${total} · Página ${currentPage} de ${totalPages}` : emptyLabel}
    </span>
    <nav aria-label={ariaLabel}>
      <button type="button" className="page-button" onClick={() => onPage(Math.max(0, offset - limit))} disabled={disabled || offset === 0} aria-label="Página anterior">←</button>
      <button type="button" className="page-button" onClick={() => onPage(offset + limit)} disabled={disabled || offset + limit >= total} aria-label="Página siguiente">→</button>
    </nav>
  </div>;
}
