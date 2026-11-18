const { defineModel } = require('../database/define-model');

module.exports = (sequelize) => defineModel(sequelize, 'AgentExecutionLog', 'agent_execution_logs');
