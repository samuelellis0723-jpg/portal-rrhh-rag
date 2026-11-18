const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');

// Solo informa si se menciona otra identidad; nunca devuelve nombre, correo ni datos de esa persona.
async function mentionsAnotherCollaborator(message, ownCollaboratorId) {
  const rows = await sequelize.query(`SELECT id, nombre FROM colaboradores
    WHERE id <> :ownCollaboratorId AND estado = 'activo'`, {
    replacements: { ownCollaboratorId }, type: QueryTypes.SELECT,
  });
  return referencesCollaboratorName(message, rows);
}

function referencesCollaboratorName(message, rows) {
  const firstNameCounts = new Map();
  for (const row of rows) {
    const first = row.nombre.trim().split(/\s+/)[0].toLocaleLowerCase();
    firstNameCounts.set(first, (firstNameCounts.get(first) || 0) + 1);
  }
  const boundary = (value) => new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegExp(value)}($|[^\\p{L}\\p{N}_])`, 'iu');
  return rows.some(({ nombre }) => {
    const normalized = nombre.trim().toLocaleLowerCase();
    if (boundary(normalized).test(message)) return true;
    const first = normalized.split(/\s+/)[0];
    return first.length >= 3 && firstNameCounts.get(first) === 1 && boundary(first).test(message);
  });
}

function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

module.exports = { mentionsAnotherCollaborator, referencesCollaboratorName };
