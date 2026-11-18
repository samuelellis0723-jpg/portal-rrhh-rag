const dateFormat = new Intl.DateTimeFormat('es-CR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const date = (value) => dateFormat.format(new Date(`${value}T00:00:00Z`));
// Solo presentación: conservar el decimal exacto recibido, sin aritmética flotante.
export const days = (value) => String(value).replace('.', ',');

export default function VacacionesTable({ items }) {
  if (!items.length) return <div className="empty-state"><span aria-hidden="true">↗</span>
    <h3>No hay períodos en esta página</h3><p>Cuando tengas un período registrado, podrás consultar su detalle aquí.</p></div>;
  return <div className="table-wrap"><table>
    <caption className="sr-only">Detalle de vacaciones propias por período. Todas las cantidades se expresan en días.</caption>
    <thead><tr><th scope="col">Período</th><th scope="col">Asignados</th><th scope="col">Tomados</th><th scope="col">Disponibles</th></tr></thead>
    <tbody>{items.map((item) => <tr key={item.id}>
      <th scope="row"><span>{date(item.periodo_inicio)}</span><span className="period-end">al {date(item.periodo_fin)}</span></th>
      <td data-label="Asignados">{days(item.dias_asignados)}</td>
      <td data-label="Tomados">{days(item.dias_tomados)}</td>
      <td data-label="Disponibles"><span className="balance-pill">{days(item.dias_disponibles)}</span></td>
    </tr>)}</tbody>
  </table></div>;
}
