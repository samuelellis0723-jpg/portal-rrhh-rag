// Snapshot v1 inmutable: no editar después de aplicar esta migración.
const { migrationFor } = require('./lib/create-table-v1');

module.exports = migrationFor('movimientos_personal');
