const rateLimit = require('express-rate-limit');

const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});

const analyzeRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many analyze requests, please try again later.' }
});

module.exports = { globalRateLimit, analyzeRateLimit };
