const express = require('express');
const fs = require('fs').promises;  // Use Promise version for async/await
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const KEYS_FILE = path.join(__dirname, 'keys.json');
const USERS_FILE = path.join(__dirname, 'users.json');

app.use(cors());
app.use(express.json());

// Load keys and users
let keys = require(KEYS_FILE);
let users = require(USERS_FILE);

// Utility functions to save files
async function saveKeys() {
  await fs.writeFile(KEYS_FILE, JSON.stringify(keys, null, 2), 'utf-8');
}
async function saveUsers() {
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

// 🔐 Key-based login
app.post('/verify-key', (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ valid: false, error: 'Missing key' });

  const isValid = keys.validKeys.includes(key.trim());
  res.json({ valid: isValid });
});

// 👤 Username/password login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Missing username or password' });
  }

  const user = users.users.find(
    (u) => u.username === username && u.password === password
  );

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

/**
 * Add a new user
 * POST /add-user
 * body: { username, password }
 */
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

/**
 * Update a user's password
 * POST /update-user-password
 * body: { username, newPassword }
 */
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

/**
 * Add a new key
 * POST /add-key
 * body: { key }
 */
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

/**
 * Remove a key
 * POST /remove-key
 * body: { key }
 */
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

app.listen(PORT, () => {
  console.log(`License/auth server running at http://localhost:${PORT}`);
});
