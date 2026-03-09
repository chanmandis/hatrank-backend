// src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

// Global: 100 req / 15 menit per IP
const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak request. Coba lagi dalam 15 menit.' }
});

// Analyze endpoint: 10 req / 15 menit per IP
// Mencegah spam analisa yang memboroskan X API quota
const analyzeRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Batas analisa tercapai. Coba lagi dalam 15 menit.' }
});

module.exports = { globalRateLimit, analyzeRateLimit };
