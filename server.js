const express = require('express');
const fs = require('fs').promises;
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

// Dynamic import for node-fetch
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;

// --- FILE PATHS ---
const KEYS_FILE = path.join(__dirname, 'keys.json');
const USERS_FILE = path.join(__dirname, 'users.json');
const TRADERS_FILE = path.join(__dirname, 'traders.json');

// --- INITIAL DATA LOAD ---
let keys = require(KEYS_FILE);
let users = require(USERS_FILE);
let traders = require(TRADERS_FILE);

// --- CONFIG ---
const ALLOWED_ORIGINS = [
  'https://rishupremium.web.app',
  'https://rishucryptoidx.web.app'
];
const TRUSTED_HEADER = 'rishu-secret';

// --- CORS ---
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.use(express.json());

// --- Rate Limiter ---
const signalsLimiter = rateLimit({
  windowMs: 60 * 1000,
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
  const isValidOrigin = ALLOWED_ORIGINS.includes(origin) || (referer && ALLOWED_ORIGINS.some(o => referer.startsWith(o)));
  const hasValidHeader = secretHeader === TRUSTED_HEADER;

  if (isBlockedAgent) {
    console.warn(`Blocked suspicious user-agent: ${userAgent} from IP: ${req.ip}`);
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

app.post('/login-trader', (req, res) => {
  const { traderId } = req.body;
  if (!traderId) {
    return res.status(400).json({ success: false, error: 'Missing trader ID' });
  }

  const isValid = traders.traders.some(t => t.traderId === traderId);
  if (isValid) {
    res.json({ success: true, traderId });
  } else {
    res.json({ success: false, error: 'Invalid trader ID' });
  }
});

app.get('/', (req, res) => {
  res.send('Auth server is running 🚀');
});

app.post('/reload-data', async (req, res) => {
  try {
    keys = JSON.parse(await fs.readFile(KEYS_FILE, 'utf-8'));
    users = JSON.parse(await fs.readFile(USERS_FILE, 'utf-8'));
    traders = JSON.parse(await fs.readFile(TRADERS_FILE, 'utf-8'));
    res.json({ success: true, message: 'Data reloaded from disk' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to reload data', details: err.message });
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

app.get('/api/binomo-signals', async (req, res) => {
  const { asset, days, accuracy, start_time, end_time } = req.query;

  if (!asset || !days || !accuracy || !start_time || !end_time) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const apiUrl = `https://binomoapi.itssrishu07.workers.dev/?asset=${encodeURIComponent(asset)}&days=${encodeURIComponent(days)}&accuracy=${encodeURIComponent(accuracy)}&start_time=${encodeURIComponent(start_time)}&end_time=${encodeURIComponent(end_time)}`;

  try {
    const response = await fetch(apiUrl);
    const text = await response.text();

    if (!response.ok) {
      return res.status(502).json({
        error: `Binomo API error (status ${response.status})`,
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
