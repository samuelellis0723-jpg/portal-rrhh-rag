'use strict';
const { DataTypes, QueryTypes } = require('sequelize');
const { syntheticNameForIndex } = require('../fixtures/synthetic-names');

module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn('usuarios', 'nombres', {
      type: DataTypes.STRING(160),
      allowNull: true,
    });
    const users = await queryInterface.sequelize.query(
      'SELECT id FROM usuarios ORDER BY id ASC',
      { type: QueryTypes.SELECT },
    );
    for (let i = 0; i < users.length; i += 1) {
      await queryInterface.sequelize.query(
        'UPDATE usuarios SET nombres = :nombres WHERE id = :id',
        { replacements: { nombres: syntheticNameForIndex(i), id: users[i].id } },
      );
    }
    await queryInterface.changeColumn('usuarios', 'nombres', {
      type: DataTypes.STRING(160),
      allowNull: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('usuarios', 'nombres');
  },
};
