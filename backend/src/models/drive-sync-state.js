const { defineModel } = require('../database/define-model');

module.exports = (sequelize) => defineModel(sequelize, 'DriveSyncState', 'drive_sync_state');
