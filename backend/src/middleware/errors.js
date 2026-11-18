const { BaseError } = require('sequelize');
const ApiError = require('../services/api-error');

function notFound(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ruta no encontrada.' } });
}

// No exponer mensajes del driver, SQL ni contenido de peticiones.
function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error instanceof ApiError) {
    return res.status(error.status).json({ error: { code: error.code, message: error.message } });
  }
  if (error instanceof BaseError) {
    return res.status(503).json({ error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'La fuente de datos no está disponible.' } });
  }
  const badJson = error.type === 'entity.parse.failed';
  const tooLarge = error.type === 'entity.too.large';
  res.status(badJson ? 400 : tooLarge ? 413 : 500).json({ error: {
    code: badJson ? 'VALIDATION_ERROR' : tooLarge ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_ERROR',
    message: badJson ? 'JSON inválido.' : tooLarge ? 'Petición demasiado grande.' : 'Error interno.',
  } });
}

module.exports = { notFound, errorHandler };
