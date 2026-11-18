const { defineModel } = require('../database/define-model');

module.exports = (sequelize) => defineModel(sequelize, 'Usuario', 'usuarios');
