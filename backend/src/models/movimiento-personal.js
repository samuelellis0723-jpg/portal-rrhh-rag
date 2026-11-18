const { defineModel } = require('../database/define-model');

module.exports = (sequelize) => defineModel(sequelize, 'MovimientoPersonal', 'movimientos_personal');
