const axios = require('axios');

const client = axios.create({
  baseURL: 'https://api.twitter.com/2',
  headers: { Authorization: `Bearer ${process.env.X_BEARER_TOKEN}` }
});

async function fetchUserProfile(username) {
  const { data } = await client.get(`/users/by/username/${username}`, {
    params: {
      'user.fields': 'public_metrics,created_at,description,profile_image_url,verified'
    }
  });
  if (data.errors) throw new Error(`User @${username} not found`);
  return data.data;
}

async function fetchTimeline(userId) {
  const { data } = await client.get(`/users/${userId}/tweets`, {
    params: {
      max_results: 100,
      'tweet.fields': 'public_metrics,referenced_tweets,created_at'
    }
  });
  return data.data || [];
}

function calcDistribution(tweets) {
  if (!tweets.length) return { original:0, reply:0, retweet:0, quote:0 };
  const c = { original:0, reply:0, retweet:0, quote:0 };
  tweets.forEach(t => {
    if (!t.referenced_tweets) { c.original++; }
    else {
      const types = t.referenced_tweets.map(r => r.type);
      if (types.includes('retweeted'))       c.retweet++;
      else if (types.includes('quoted'))     c.quote++;
      else if (types.includes('replied_to')) c.reply++;
      else c.original++;
    }
  });
  const n = tweets.length;
  return {
    original: +((c.original/n)*100).toFixed(1),
    reply:    +((c.reply/n)*100).toFixed(1),
    retweet:  +((c.retweet/n)*100).toFixed(1),
    quote:    +((c.quote/n)*100).toFixed(1),
  };
}

function calcEngagementRate(tweets, followersCount) {
  if (!tweets.length || !followersCount) return 0;
  const total = tweets.reduce((sum, t) => {
    const m = t.public_metrics || {};
    return sum + (m.like_count||0) + (m.retweet_count||0) + (m.reply_count||0);
  }, 0);
  return +((total / tweets.length / followersCount) * 100).toFixed(2);
}

module.exports = { fetchUserProfile, fetchTimeline, calcDistribution, calcEngagementRate };
