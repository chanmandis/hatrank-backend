// src/index.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const { createLogger, transports, format } = require('winston');

const analyzeRouter = require('./routes/analyze');
const { globalRateLimit } = require('./middleware/rateLimiter');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Logger ───────────────────────────────────────────
const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()]
});

// ── Middleware ───────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());
app.use(globalRateLimit);

// ── Routes ───────────────────────────────────────────
app.use('/api/analyze', analyzeRouter);

app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date() }));

// ── Error Handler ────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(err.message, { stack: err.stack });
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => logger.info(`HatRank API running on :${PORT}`));
