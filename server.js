const express = require('express');
const fs = require('fs');
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

app.listen(PORT, () => {
  console.log(`License/auth server running at http://localhost:${PORT}`);
});
