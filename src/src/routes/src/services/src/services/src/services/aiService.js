const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generateNarrative(profile) {
  const {
    username, displayName, followersCount, tweetCount,
    engagementRate, hatTitle, hatLevel, activityScore,
    distribution, bio
  } = profile;

  const prompt = `You are a digital personality analyst for HatRank.

X account data for @${username}:
- Name: ${displayName || username}
- Bio: ${bio || '(none)'}
- Badge: ${hatTitle} (Level ${hatLevel}/6)
- Activity score: ${activityScore}/100
- Followers: ${followersCount.toLocaleString()}
- Total tweets: ${tweetCount.toLocaleString()}
- Engagement rate: ${engagementRate}%
- Distribution: ${distribution.original}% original, ${distribution.reply}% reply, ${distribution.retweet}% RT, ${distribution.quote}% quote

Write a 3-4 sentence analysis in English. Style: journalistic, slightly poetic, insightful. Do not mention "HatRank".`;

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }]
  });

  return msg.content[0]?.text || '';
}

module.exports = { generateNarrative };
