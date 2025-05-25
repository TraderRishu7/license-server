const express = require('express');
const fs = require('fs').promises;
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'RishuAdmin';

const KEYS_FILE = path.join(__dirname, 'keys.json');
const USERS_FILE = path.join(__dirname, 'users.json');
const LOGIN_ATTEMPTS_FILE = path.join(__dirname, 'loginAttempts.json');

app.use(cors());
app.use(express.json());

// Load keys and users
let keys = require(KEYS_FILE);
let users = require(USERS_FILE);

let loginAttempts = [];

// Utility functions to save files
async function saveKeys() {
  await fs.writeFile(KEYS_FILE, JSON.stringify(keys, null, 2), 'utf-8');
}
async function saveUsers() {
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}
async function saveLoginAttempts() {
  await fs.writeFile(LOGIN_ATTEMPTS_FILE, JSON.stringify(loginAttempts, null, 2), 'utf-8');
}

// 🔐 Key-based login
app.post('/verify-key', (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ valid: false, error: 'Missing key' });

  const isValid = keys.validKeys.includes(key.trim());
  res.json({ valid: isValid });
});

// 👤 Username/password login with loginAttempts tracking
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Missing username or password' });
  }

  const user = users.users.find(
    (u) => u.username === username && u.password === password
  );

  loginAttempts.push({
    username,
    success: !!user,
    timestamp: new Date().toISOString(),
  });

  if (user) {
    res.json({ success: true, user: { username: user.username } });
  } else {
    res.json({ success: false, error: 'Invalid credentials' });
  }
});

// 🌐 Health check
app.get('/', (req, res) => {
  res.send('Auth server is running 🚀');
});

// Add a new user
app.post('/add-user', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Missing username or password' });
  }
  
  if (users.users.find(u => u.username === username)) {
    return res.status(400).json({ success: false, error: 'Username already exists' });
  }

  users.users.push({ username, password });

  try {
    await saveUsers();
    res.json({ success: true, message: 'User added successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to save user' });
  }
});

// Update a user's password
app.post('/update-user-password', async (req, res) => {
  const { username, newPassword } = req.body;
  if (!username || !newPassword) {
    return res.status(400).json({ success: false, error: 'Missing username or new password' });
  }

  const user = users.users.find(u => u.username === username);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  user.password = newPassword;

  try {
    await saveUsers();
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to save changes' });
  }
});

// Add a new key
app.post('/add-key', async (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ success: false, error: 'Missing key' });

  if (keys.validKeys.includes(key)) {
    return res.status(400).json({ success: false, error: 'Key already exists' });
  }

  keys.validKeys.push(key);

  try {
    await saveKeys();
    res.json({ success: true, message: 'Key added successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to save keys' });
  }
});

// Remove a key
app.post('/remove-key', async (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ success: false, error: 'Missing key' });

  const index = keys.validKeys.indexOf(key);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Key not found' });
  }

  keys.validKeys.splice(index, 1);

  try {
    await saveKeys();
    res.json({ success: true, message: 'Key removed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to save keys' });
  }
});

// Reload data from disk
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

// Admin route to get login attempts (secured by ADMIN_SECRET in Authorization header)
app.get('/admin/login-attempts', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];
  if (token !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Forbidden: Invalid admin secret' });
  }

  res.json(loginAttempts);
});

// Periodically save login attempts every 60 seconds
setInterval(() => {
  saveLoginAttempts().catch(console.error);
}, 60 * 1000);

app.listen(PORT, () => {
  console.log(`License/auth server running at http://localhost:${PORT}`);
});
