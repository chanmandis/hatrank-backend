// src/services/xApiService.js
const axios = require('axios');

const BASE = 'https://api.twitter.com/2';
const BEARER = process.env.X_BEARER_TOKEN;

const client = axios.create({
  baseURL: BASE,
  headers: { Authorization: `Bearer ${BEARER}` }
});

/**
 * Fetch user profile + public metrics dari X API v2
 */
async function fetchUserProfile(username) {
  const { data } = await client.get(`/users/by/username/${username}`, {
    params: {
      'user.fields': [
        'public_metrics',
        'created_at',
        'description',
        'profile_image_url',
        'verified',
        'entities'
      ].join(',')
    }
  });
  if (data.errors) throw new Error(`User @${username} tidak ditemukan`);
  return data.data;
}

/**
 * Fetch timeline terbaru (max 100 tweet) untuk analisa distribusi aktivitas
 */
async function fetchTimeline(userId) {
  const { data } = await client.get(`/users/${userId}/tweets`, {
    params: {
      max_results: 100,
      'tweet.fields': 'public_metrics,referenced_tweets,created_at',
      exclude: 'replies'  // Bisa diubah sesuai kebutuhan
    }
  });
  return data.data || [];
}

/**
 * Hitung distribusi tipe tweet dari timeline
 */
function calcDistribution(tweets) {
  if (!tweets.length) return { original: 0, reply: 0, retweet: 0, quote: 0 };

  const counts = { original: 0, reply: 0, retweet: 0, quote: 0 };
  tweets.forEach(t => {
    if (!t.referenced_tweets) {
      counts.original++;
    } else {
      const types = t.referenced_tweets.map(r => r.type);
      if (types.includes('retweeted'))      counts.retweet++;
      else if (types.includes('quoted'))    counts.quote++;
      else if (types.includes('replied_to')) counts.reply++;
      else counts.original++;
    }
  });

  const total = tweets.length;
  return {
    original: +((counts.original / total) * 100).toFixed(1),
    reply:    +((counts.reply    / total) * 100).toFixed(1),
    retweet:  +((counts.retweet  / total) * 100).toFixed(1),
    quote:    +((counts.quote    / total) * 100).toFixed(1),
  };
}

/**
 * Hitung engagement rate rata-rata dari timeline
 */
function calcEngagementRate(tweets, followersCount) {
  if (!tweets.length || !followersCount) return 0;
  const totalEng = tweets.reduce((sum, t) => {
    const m = t.public_metrics || {};
    return sum + (m.like_count || 0) + (m.retweet_count || 0) + (m.reply_count || 0);
  }, 0);
  const avgEng = totalEng / tweets.length;
  return +((avgEng / followersCount) * 100).toFixed(2);
}

module.exports = { fetchUserProfile, fetchTimeline, calcDistribution, calcEngagementRate };
