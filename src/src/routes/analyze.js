const express = require('express');
const { z }   = require('zod');
const { PrismaClient } = require('@prisma/client');

const xApi   = require('../services/xApiService');
const engine = require('../services/hatEngine');
const ai     = require('../services/aiService');
const cache  = require('../services/cacheService');
const { analyzeRateLimit } = require('../middleware/rateLimiter');

const router = express.Router();
const prisma = new PrismaClient();

const Schema = z.object({
  username: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_]+$/)
});

router.post('/', analyzeRateLimit, async (req, res, next) => {
  try {
    const { username } = Schema.parse(req.body);
    const key = username.toLowerCase();

    const cached = await cache.getCached(key);
    if (cached) return res.json({ ...cached, source: 'cache' });

    const existing = await prisma.analysisResult.findUnique({ where: { username: key } });
    if (existing && cache.isFresh(existing.lastFetchedAt)) {
      await cache.setCached(key, existing);
      return res.json({ ...existing, source: 'db' });
    }

    let xProfile, timeline;
    try {
      xProfile = await xApi.fetchUserProfile(username);
      timeline = await xApi.fetchTimeline(xProfile.id);
    } catch (err) {
      if (existing) return res.json({ ...existing, source: 'db_stale' });
      throw err;
    }

    const metrics = xProfile.public_metrics;
    const dist    = xApi.calcDistribution(timeline);
    const engRate = xApi.calcEngagementRate(timeline, metrics.followers_count);
    const score   = engine.calcActivityScore({
      followersCount: metrics.followers_count,
      tweetCount:     metrics.tweet_count,
      engagementRate: engRate,
      joinedAt:       xProfile.created_at
    });
    const hat = engine.assignHat(score);

    const needsAI = !existing || !existing.aiAnalysis || existing.hatLevel !== hat.level;
    let aiAnalysis = existing?.aiAnalysis || '';
    if (needsAI) {
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

    const result = await prisma.analysisResult.upsert({
      where:  { username: key },
      create: {
        username, displayName: xProfile.name, bio: xProfile.description,
        profileImage: xProfile.profile_image_url, verified: xProfile.verified || false,
        joinedAt: xProfile.created_at ? new Date(xProfile.created_at) : null,
        followersCount: metrics.followers_count, followingCount: metrics.following_count,
        tweetCount: metrics.tweet_count, likeCount: metrics.like_count || 0,
        originalTweetPct: dist.original, replyPct: dist.reply,
        retweetPct: dist.retweet, quotePct: dist.quote,
        activityScore: score, engagementRate: engRate,
        hatLevel: hat.level, hatTitle: hat.title, hatEmoji: hat.emoji,
        aiAnalysis, lastFetchedAt: new Date()
      },
      update: {
        displayName: xProfile.name, bio: xProfile.description,
        profileImage: xProfile.profile_image_url,
        followersCount: metrics.followers_count, followingCount: metrics.following_count,
        tweetCount: metrics.tweet_count, likeCount: metrics.like_count || 0,
        originalTweetPct: dist.original, replyPct: dist.reply,
        retweetPct: dist.retweet, quotePct: dist.quote,
        activityScore: score, engagementRate: engRate,
        hatLevel: hat.level, hatTitle: hat.title, hatEmoji: hat.emoji,
        aiAnalysis, lastFetchedAt: new Date()
      }
    });

    await cache.setCached(key, result);
    return res.json({ ...result, source: 'fresh' });

  } catch (err) { next(err); }
});

router.get('/:username', async (req, res, next) => {
  try {
    const { username } = Schema.parse({ username: req.params.username });
    const result = await prisma.analysisResult.findUnique({ where: { username: username.toLowerCase() } });
    if (!result) return res.status(404).json({ error: 'Username not found' });
    return res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
