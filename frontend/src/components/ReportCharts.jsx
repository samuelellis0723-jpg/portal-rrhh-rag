const display = (value) => value === null || value === undefined ? 'Sin datos' : String(value);

export function TrendChart({ items = [] }) {
  items = Array.isArray(items) ? items : [];
  const known = items.filter((item) => typeof item.consultas === 'number');
  const max = Math.max(1, ...known.map((item) => item.consultas));
  const width = 600, height = 180, pad = 20;
  const x = (index) => pad + index * (width - pad * 2) / Math.max(1, items.length - 1);
  const y = (value) => height - pad - value * (height - pad * 2) / max;
  let segment = [];
  const segments = [];
  items.forEach((item, index) => {
    if (typeof item.consultas === 'number') segment.push(`${x(index)},${y(item.consultas)}`);
    else if (segment.length) { segments.push(segment); segment = []; }
  });
  if (segment.length) segments.push(segment);
  return <figure className="report-chart"><figcaption><h3>Uso del asistente</h3><p>Consultas en los 30 días anteriores al reporte.</p></figcaption>
    {!known.length ? <p className="chart-empty">No hay cifras disponibles para esta ventana.</p> : <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Tendencia de consultas durante treinta días">
      {[0, 0.5, 1].map((step) => <line key={step} x1={pad} y1={y(max * step)} x2={width - pad} y2={y(max * step)} stroke="#e1e7d8" strokeDasharray="4 5" />)}
      {segments.map((points, index) => <polyline key={index} points={points.join(' ')} fill="none" stroke="#56754a" strokeWidth="2.5" />)}
      {items.map((item, index) => typeof item.consultas === 'number' && <circle key={item.fecha} cx={x(index)} cy={y(item.consultas)} r="3" fill="#56754a"><title>{item.fecha}: {item.consultas} consultas</title></circle>)}
    </svg>}
    <div className="chart-dates"><span>{items[0]?.fecha || '—'}</span><span>{items.at(-1)?.fecha || '—'}</span></div>
    <details><summary>Ver datos de la gráfica</summary><div className="table-wrap"><table><caption className="sr-only">Consultas por fecha</caption><thead><tr><th>Fecha</th><th>Consultas</th></tr></thead><tbody>{items.map((item) => <tr key={item.fecha}><th scope="row">{item.fecha}</th><td>{display(item.consultas)}</td></tr>)}</tbody></table></div></details>
  </figure>;
}

export function DepartmentChart({ items = [] }) {
  const unavailable = items === null;
  items = Array.isArray(items) ? items : [];
  const max = Math.max(1, ...items.map((item) => item.total));
  return <figure className="report-chart"><figcaption><h3>Riesgo de vacaciones por área</h3><p>Personas que superan el umbral de días del reporte.</p></figcaption>
    {!items.length ? <p className="chart-empty">{unavailable ? 'No hay datos confiables para calcular este indicador.' : 'No hay áreas con personas sobre el umbral.'}</p> : <div className="department-bars">{items.map((item) => <div className="department-bar" key={item.departamento}>
      <div><span>{item.departamento}</span><strong>{item.total}</strong></div><div className="bar-track"><span style={{ width: `${100 * item.total / max}%` }} /></div>
    </div>)}</div>}
  </figure>;
}
