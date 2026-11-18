const express = require('express');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errors');

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  next();
});
app.use(express.json({ limit: '16kb' }));
app.use('/api/v1', routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
