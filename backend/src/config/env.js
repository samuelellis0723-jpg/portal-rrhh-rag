const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

function integer(name, fallback, min = 1, max = 65535) {
  const value = process.env[name] === undefined ? fallback : Number(process.env[name]);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Configuración inválida: ${name}`);
  }
  return value;
}

module.exports = { integer };
