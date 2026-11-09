require('dotenv').config();
const path = require('path');
const express = require('express');
const pool = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Health check: proves the server can reach MySQL
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'connected' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ ok: false, db: 'unreachable' });
  }
});

app.use('/api/listings', require('./routes/listings.routes'));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`http://localhost:${port}`));
