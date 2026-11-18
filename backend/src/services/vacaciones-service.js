const { ownBalance } = require('../repositories/vacaciones-repository');

function getOwnBalance(auth, pagination) {
  return ownBalance(auth.data.colaborador.id, pagination);
}

module.exports = { getOwnBalance };
