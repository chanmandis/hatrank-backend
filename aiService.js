// src/services/aiService.js
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Generate AI narrative analisa akun X
 * Dipanggil hanya saat data baru / akun belum pernah dianalisa
 */
async function generateNarrative(profile) {
  const {
    username, displayName, followersCount, tweetCount,
    engagementRate, hatTitle, hatLevel, activityScore,
    distribution, bio
  } = profile;

  const prompt = `Kamu adalah analis kepribadian digital untuk platform HatRank.

Data akun X @${username}:
- Nama: ${displayName || username}
- Bio: ${bio || '(tidak ada)'}
- Badge: ${hatTitle} (Level ${hatLevel}/6)
- Skor aktivitas: ${activityScore}/100
- Followers: ${followersCount.toLocaleString('id-ID')}
- Total tweets: ${tweetCount.toLocaleString('id-ID')}
- Engagement rate: ${engagementRate}%
- Distribusi: ${distribution.original}% original, ${distribution.reply}% reply, ${distribution.retweet}% RT, ${distribution.quote}% quote

Tulis analisa 3–4 kalimat bahasa Indonesia yang:
- Tajam, jurnalistik, sedikit puitis
- Menjelaskan karakter digital akun ini
- Menyebutkan pola perilaku yang menonjol dari data
- TIDAK menyebut "HatRank", TIDAK mengulangi angka mentah

Hanya tulis paragraf analisa, tanpa judul atau label.`;

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }]
  });

  return msg.content[0]?.text || '';
}

module.exports = { generateNarrative };
