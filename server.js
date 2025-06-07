const express = require('express');
const fs = require('fs').promises;
const cors = require('cors');
const path = require('path');

// Dynamic import for node-fetch (v3+) in CommonJS environment
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;

const KEYS_FILE = path.join(__dirname, 'keys.json');
const USERS_FILE = path.join(__dirname, 'users.json');

app.use(cors());
app.use(express.json());

let keys = require(KEYS_FILE);
let users = require(USERS_FILE);

// --- KEY VERIFICATION ---
app.post('/verify-key', (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ valid: false, error: 'Missing key' });

  const isValid = keys.validKeys.includes(key.trim());
  res.json({ valid: isValid });
});

// --- LOGIN ---
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

// --- HOME ---
app.get('/', (req, res) => {
  res.send('Auth server is running 🚀');
});

// --- RELOAD DATA (keys and users) ---
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

// --- SIGNAL API ROUTE ---
app.get('/api/signals', async (req, res) => {
  const { start_time, end_time, assets, day } = req.query;

  if (!start_time || !end_time || !assets || !day) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const apiUrl = `https://quotexapi.itssrishu07.workers.dev/?start_time=${encodeURIComponent(start_time)}&end_time=${encodeURIComponent(end_time)}&assets=${encodeURIComponent(assets)}&day=${encodeURIComponent(day)}`;

  try {
    const response = await fetch(apiUrl);
    const text = await response.text();

    console.log(`Response from Quotex API (status ${response.status}):`, text);

    if (!response.ok) {
      return res.status(502).json({
        error: `Quotex API returned status ${response.status}`,
        details: text
      });
    }

    res.send(text);
  } catch (err) {
    console.error('Internal fetch error:', err.message);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
});

// --- START SERVER ---
app.listen(PORT, () => {
  console.log(`Auth + Signal server running at http://localhost:${PORT}`);
});
