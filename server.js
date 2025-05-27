const express = require('express');
const fs = require('fs').promises;
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

const KEYS_FILE = path.join(__dirname, 'keys.json');
const USERS_FILE = path.join(__dirname, 'users.json');
const LOGIN_ATTEMPTS_FILE = path.join(__dirname, 'loginAttempts.json');

app.use(cors());
app.use(express.json());

// Load keys and users
let keys = require(KEYS_FILE);
let users = require(USERS_FILE);

// Load login attempts or init empty
let loginAttempts = [];
try {
  loginAttempts = require(LOGIN_ATTEMPTS_FILE);
} catch {
  loginAttempts = [];
}

// Utility function to save login attempts only
async function saveLoginAttempts() {
  await fs.writeFile(LOGIN_ATTEMPTS_FILE, JSON.stringify(loginAttempts, null, 2), 'utf-8');
}

// 🔐 Key-based login (just verify key exists in keys.json)
app.post('/verify-key', (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ valid: false, error: 'Missing key' });

  const isValid = keys.validKeys.includes(key.trim());
  res.json({ valid: isValid });
});

// 👤 Username/password login (check against users.json)
app.post('/login', async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || 
             req.connection.remoteAddress || 
             req.socket.remoteAddress || 
             '';
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Missing username or password' });
  }

  const user = users.users.find(u => u.username === username && u.password === password);
  const loginSuccess = !!user;

  // Record the login attempt
  loginAttempts.push({
    timestamp: Date.now(),
    username: username,
    success: loginSuccess,
    ip: ip
  });

  // Save loginAttempts asynchronously
  try {
    await saveLoginAttempts();
  } catch (err) {
    console.error('Failed to save login attempts:', err);
  }

  if (loginSuccess) {
    res.json({ success: true, user: { username: user.username } });
  } else {
    res.json({ success: false, error: 'Invalid credentials' });
  }
});

// 🌐 Health check
app.get('/', (req, res) => {
  res.send('Auth server is running 🚀');
});

/**
 * Reload data from disk
 * POST /reload-data
 */
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

/**
 * Admin: Get login attempts
 * GET /admin/login-attempts
 * Header: Authorization: Bearer <ADMIN_SECRET>
 */
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'Rishuadmin';

app.get('/admin/login-attempts', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (token !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.json(loginAttempts);
});

/**
 * Proxy endpoint for Quotex signals
 */
app.get('/proxy-signals', async (req, res) => {
  try {
    const { start_time, end_time, assets, day } = req.query;

    if (!start_time || !end_time || !assets || !day) {
      return res.status(400).json({ error: 'Missing required query parameters' });
    }

    const apiUrl = `https://quotexapi.itssrishu07.workers.dev/?start_time=${encodeURIComponent(start_time)}&end_time=${encodeURIComponent(end_time)}&assets=${encodeURIComponent(assets)}&day=${encodeURIComponent(day)}`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch from external API' });
    }

    const data = await response.json();

    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(PORT, () => {
  console.log(`License/auth server running at http://localhost:${PORT}`);
});
