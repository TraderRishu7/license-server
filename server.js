const express = require('express');
const fs = require('fs').promises;
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

// Dynamic import for node-fetch
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;

const KEYS_FILE = path.join(__dirname, 'keys.json');
const USERS_FILE = path.join(__dirname, 'users.json');

let keys = require(KEYS_FILE);
let users = require(USERS_FILE);

// --- CONFIG ---
const ALLOWED_ORIGIN = 'https://rishupremium.web.app';
const TRUSTED_HEADER = 'rishu-secret';

// --- CORS ---
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || origin === ALLOWED_ORIGIN) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.use(express.json());

// --- Rate Limiter ---
const signalsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: { error: 'Too many requests, try again later.' }
});

// --- Global Error Handler ---
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS error: This origin is not allowed' });
  }
  next(err);
});

// --- Middleware to block Postman/curl + require custom header ---
app.use('/api/signals', signalsLimiter, (req, res, next) => {
  const userAgent = req.headers['user-agent'] || '';
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  const secretHeader = req.headers['x-trusted-client'];

  const isBlockedAgent = /postman|curl|httpie|insomnia/i.test(userAgent);
  const isValidOrigin = origin === ALLOWED_ORIGIN || referer.startsWith(ALLOWED_ORIGIN);
  const hasValidHeader = secretHeader === TRUSTED_HEADER;

  if (isBlockedAgent) {
    return res.status(403).json({ error: 'Forbidden: Suspicious User-Agent' });
  }

  if (!isValidOrigin) {
    return res.status(403).json({ error: 'Forbidden: Invalid origin or referer' });
  }

  if (!hasValidHeader) {
    return res.status(403).json({ error: 'Forbidden: Missing or invalid client header' });
  }

  next();
});

// --- API Routes ---
app.post('/verify-key', (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ valid: false, error: 'Missing key' });

  const isValid = keys.validKeys.includes(key.trim());
  res.json({ valid: isValid });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Missing username or password' });
  }

  const user = users.users.find(u => u.username === username && u.password === password);
  if (user) {
    res.json({ success: true, user: { username: user.username } });
  } else {
    res.json({ success: false, error: 'Invalid credentials' });
  }
});

app.get('/', (req, res) => {
  res.send('Auth server is running 🚀');
});

app.post('/reload-data', (req, res) => {
  try {
    delete require.cache[require.resolve(KEYS_FILE)];
    delete require.cache[require.resolve(USERS_FILE)];
    keys = require(KEYS_FILE);
    users = require(USERS_FILE);
    res.json({ success: true, message: 'Data reloaded from disk' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to reload data' });
  }
});

// --- Protected Signal API ---
app.get('/api/signals', async (req, res) => {
  const { start_time, end_time, assets, day } = req.query;

  if (!start_time || !end_time || !assets || !day) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const apiUrl = `https://quotexapi.itssrishu07.workers.dev/?start_time=${encodeURIComponent(start_time)}&end_time=${encodeURIComponent(end_time)}&assets=${encodeURIComponent(assets)}&day=${encodeURIComponent(day)}`;

  try {
    const response = await fetch(apiUrl);
    const text = await response.text();

    if (!response.ok) {
      return res.status(502).json({
        error: `Quotex API error (status ${response.status})`,
        details: text
      });
    }

    res.send(text);
  } catch (err) {
    console.error('Internal fetch error:', err.message);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Auth + Signal server running at http://localhost:${PORT}`);
});
