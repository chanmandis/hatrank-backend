// src/services/cacheService.js
const { createClient } = require('redis');

let redisClient = null;

async function getClient() {
  if (!redisClient) {
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.on('error', err => console.error('[Redis]', err));
    await redisClient.connect();
  }
  return redisClient;
}

const FRESH_TTL = parseInt(process.env.CACHE_TTL_FRESH  || '3600');   // 1 jam
const STALE_TTL = parseInt(process.env.CACHE_TTL_STALE  || '86400');  // 24 jam

async function getCached(username) {
  try {
    const rc = await getClient();
    const val = await rc.get(`hr:${username.toLowerCase()}`);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
}

async function setCached(username, data) {
  try {
    const rc = await getClient();
    await rc.setEx(`hr:${username.toLowerCase()}`, FRESH_TTL, JSON.stringify(data));
  } catch { /* Redis failure non-fatal */ }
}

/**
 * Cek apakah cache masih fresh (< FRESH_TTL)
 * Digunakan untuk memutuskan apakah perlu re-fetch X API
 */
function isFresh(lastFetchedAt) {
  return (Date.now() - new Date(lastFetchedAt).getTime()) < FRESH_TTL * 1000;
}

module.exports = { getCached, setCached, isFresh };
