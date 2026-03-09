require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');

const analyzeRouter = require('./routes/analyze');
const { globalRateLimit } = require('./middleware/rateLimiter');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET','POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());
app.use(globalRateLimit);

app.use('/api/analyze', analyzeRouter);

app.get('/health', (_, res) => res.json({
  status: 'ok',
  service: 'HatRank API',
  ts: new Date().toISOString()
}));

app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => console.log(`[HatRank] API running on port ${PORT}`));
```

Klik **Commit changes** → **Commit changes** lagi.

---

Setelah commit, lanjut buat file berikutnya. Ketik di field nama file:
```
src/routes/analyze.js
