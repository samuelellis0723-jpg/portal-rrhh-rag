const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');

async function ownBalance(colaboradorId, { limit, offset }) {
  // Una sola consulta da página y agregado del mismo snapshot, incluso con página vacía.
  const rows = await sequelize.query(`SELECT p.*, a.total, a.total_dias_disponibles
    FROM (SELECT COUNT(*) AS total, CAST(COALESCE(SUM(dias_disponibles), 0) AS DECIMAL(16,2)) AS total_dias_disponibles
      FROM saldos_vacaciones WHERE colaborador_id = :colaboradorId) a
    LEFT JOIN (SELECT id, periodo_inicio, periodo_fin, dias_asignados, dias_tomados, dias_disponibles
      FROM saldos_vacaciones WHERE colaborador_id = :colaboradorId
      ORDER BY periodo_inicio DESC, id ASC LIMIT :limit OFFSET :offset) p ON 1=1
    ORDER BY p.periodo_inicio DESC, p.id ASC`, {
    replacements: { colaboradorId, limit, offset }, type: QueryTypes.SELECT,
  });
  return { items: rows.filter((row) => row.id !== null).map(({ total, total_dias_disponibles, ...item }) => item),
    limit, offset, total: Number(rows[0].total), total_dias_disponibles: rows[0].total_dias_disponibles };
}

module.exports = { ownBalance };
