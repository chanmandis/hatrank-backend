const HATS = [
  { level:1, emoji:'🎩', title:'PHANTOM HAT',  subtitle:'The Silent Observer',   min:0,  max:15  },
  { level:2, emoji:'🧢', title:'ROOKIE CAP',   subtitle:'The Learning Explorer', min:16, max:32  },
  { level:3, emoji:'👒', title:'STRAW HAT',    subtitle:'The Casual Regular',    min:33, max:50  },
  { level:4, emoji:'🪖', title:'FIELD HAT',    subtitle:'The Engaged Fighter',   min:51, max:68  },
  { level:5, emoji:'🎓', title:'SCHOLAR HAT',  subtitle:'The Thought Leader',    min:69, max:84  },
  { level:6, emoji:'👑', title:'CROWN HAT',    subtitle:'The Digital Royalty',   min:85, max:100 },
];

function calcActivityScore({ followersCount, tweetCount, engagementRate, joinedAt }) {
  const followerScore = Math.min(30, (Math.log10(Math.max(followersCount, 1)) / 7) * 30);
  const tweetScore    = Math.min(25, (Math.log10(Math.max(tweetCount, 1)) / 5) * 25);
  const engScore      = Math.min(25, (Math.min(engagementRate, 10) / 10) * 25);
  const years = joinedAt
    ? (Date.now() - new Date(joinedAt).getTime()) / (1000*60*60*24*365)
    : 0;
  const ageScore = Math.min(20, (years / 10) * 20);
  return Math.round(Math.min(100, Math.max(0, followerScore + tweetScore + engScore + ageScore)));
}

function assignHat(score) {
  return HATS.find(h => score >= h.min && score <= h.max) || HATS[0];
}

module.exports = { calcActivityScore, assignHat, HATS };
