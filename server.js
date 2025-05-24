const express = require('express');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 3000;
const KEYS_FILE = './keys.json';

app.use(cors());
app.use(express.json());

// Load keys
let keys = require(KEYS_FILE);

// Verify key endpoint
app.post('/verify-key', (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ valid: false, error: 'Missing key' });

  const isValid = keys.validKeys.includes(key.trim());
  res.json({ valid: isValid });
});

// Update keys (e.g., via admin panel or script)
app.post('/update-keys', (req, res) => {
  const { newKeys } = req.body;
  if (!Array.isArray(newKeys)) return res.status(400).json({ error: 'Invalid format' });

  keys.validKeys = newKeys;
  fs.writeFile(KEYS_FILE, JSON.stringify(keys, null, 2), err => {
    if (err) return res.status(500).json({ error: 'Failed to save keys' });
    res.json({ success: true, validKeys: keys.validKeys });
  });
});

app.listen(PORT, () => {
  console.log(`License server running at http://localhost:${PORT}`);
});
