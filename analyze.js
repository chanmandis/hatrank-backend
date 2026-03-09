// src/routes/analyze.js
const express = require('express');
const { z }   = require('zod');
const { PrismaClient } = require('@prisma/client');

const xApi    = require('../services/xApiService');
const engine  = require('../services/hatEngine');
const ai      = require('../services/aiService');
const cache   = require('../services/cacheService');
const { analyzeRateLimit } = require('../middleware/rateLimiter');

const router = express.Router();
const prisma = new PrismaClient();

const UsernameSchema = z.object({
  username: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_]+$/, 'Username tidak valid')
});

/**
 * POST /api/analyze
 * Body: { username: "elonmusk" }
 *
 * Flow:
 *  1. Validasi input
 *  2. Cek Redis cache → return jika fresh
 *  3. Cek DB → return jika fresh
 *  4. Fetch X API (profile + timeline)
 *  5. Hitung score & assign hat
 *  6. Generate AI narrative (jika akun baru atau analysis kosong)
 *  7. Simpan ke DB + cache
 *  8. Return hasil
 */
router.post('/', analyzeRateLimit, async (req, res, next) => {
  try {
    // 1. Validasi
    const { username } = UsernameSchema.parse(req.body);
    const key = username.toLowerCase();

    // 2. Redis cache
    const cached = await cache.getCached(key);
    if (cached) {
      return res.json({ ...cached, source: 'cache' });
    }

    // 3. DB check
    const existing = await prisma.analysisResult.findUnique({ where: { username: key } });
    if (existing && cache.isFresh(existing.lastFetchedAt)) {
      await cache.setCached(key, existing);
      return res.json({ ...existing, source: 'db' });
    }

    // 4. Fetch dari X API
    let xProfile, timeline;
    try {
      xProfile = await xApi.fetchUserProfile(username);
      timeline = await xApi.fetchTimeline(xProfile.id);
    } catch (err) {
      // Jika X API gagal tapi ada data lama di DB, kembalikan data lama
      if (existing) {
        return res.json({ ...existing, source: 'db_stale', warning: 'X API tidak tersedia saat ini' });
      }
      throw err;
    }

    // 5. Scoring
    const metrics  = xProfile.public_metrics;
    const dist     = xApi.calcDistribution(timeline);
    const engRate  = xApi.calcEngagementRate(timeline, metrics.followers_count);
    const score    = engine.calcActivityScore({
      followersCount: metrics.followers_count,
      tweetCount:     metrics.tweet_count,
      engagementRate: engRate,
      joinedAt:       xProfile.created_at
    });
    const hat = engine.assignHat(score);

    // 6. AI Narrative (generate baru jika akun baru atau belum ada)
    const needsNewNarrative = !existing || !existing.aiAnalysis ||
      (existing.hatLevel !== hat.level); // Regenerate jika level naik/turun
    
    let aiAnalysis = existing?.aiAnalysis || '';
    if (needsNewNarrative) {
      aiAnalysis = await ai.generateNarrative({
        username: key,
        displayName:    xProfile.name,
        bio:            xProfile.description,
        followersCount: metrics.followers_count,
        tweetCount:     metrics.tweet_count,
        engagementRate: engRate,
        hatTitle:       hat.title,
        hatLevel:       hat.level,
        activityScore:  score,
        distribution:   dist
      });
    }

    // 7. Upsert DB
    const result = await prisma.analysisResult.upsert({
      where:  { username: key },
      create: {
        username:         key,
        displayName:      xProfile.name,
        bio:              xProfile.description,
        profileImage:     xProfile.profile_image_url,
        verified:         xProfile.verified || false,
        joinedAt:         xProfile.created_at ? new Date(xProfile.created_at) : null,
        followersCount:   metrics.followers_count,
        followingCount:   metrics.following_count,
        tweetCount:       metrics.tweet_count,
        likeCount:        metrics.like_count || 0,
        originalTweetPct: dist.original,
        replyPct:         dist.reply,
        retweetPct:       dist.retweet,
        quotePct:         dist.quote,
        activityScore:    score,
        engagementRate:   engRate,
        hatLevel:         hat.level,
        hatTitle:         hat.title,
        hatEmoji:         hat.emoji,
        aiAnalysis,
        lastFetchedAt:    new Date()
      },
      update: {
        displayName:      xProfile.name,
        bio:              xProfile.description,
        profileImage:     xProfile.profile_image_url,
        followersCount:   metrics.followers_count,
        followingCount:   metrics.following_count,
        tweetCount:       metrics.tweet_count,
        likeCount:        metrics.like_count || 0,
        originalTweetPct: dist.original,
        replyPct:         dist.reply,
        retweetPct:       dist.retweet,
        quotePct:         dist.quote,
        activityScore:    score,
        engagementRate:   engRate,
        hatLevel:         hat.level,
        hatTitle:         hat.title,
        hatEmoji:         hat.emoji,
        aiAnalysis,
        lastFetchedAt:    new Date()
      }
    });

    await cache.setCached(key, result);
    return res.json({ ...result, source: 'fresh' });

  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/analyze/:username
 * Ambil hasil terakhir tanpa trigger re-fetch
 */
router.get('/:username', async (req, res, next) => {
  try {
    const { username } = UsernameSchema.parse({ username: req.params.username });
    const result = await prisma.analysisResult.findUnique({ where: { username: username.toLowerCase() } });
    if (!result) return res.status(404).json({ error: 'Username belum pernah dianalisa' });
    return res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
