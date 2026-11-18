const { Op } = require('sequelize');
const { Usuario, Colaborador, Sesion } = require('../models');

const person = { model: Colaborador, as: 'colaborador', required: true,
  attributes: ['id', 'nombre', 'correo', 'rol', 'estado'] };

function findUser(email) {
  return Usuario.findOne({ include: [{ ...person, where: { correo: email } }] });
}

function findSession(tokenHash) {
  return Sesion.findOne({ where: { token_hash: tokenHash, revocada_en: null, expira_en: { [Op.gt]: new Date() } },
    include: [{ model: Usuario, as: 'usuario', required: true,
      attributes: ['id', 'colaborador_id', 'estado'], include: [person] }] });
}

function createSession(values) { return Sesion.create(values); }
function revokeSession(id) {
  return Sesion.update({ revocada_en: new Date() }, { where: { id, revocada_en: null } });
}

module.exports = { findUser, findSession, createSession, revokeSession };
