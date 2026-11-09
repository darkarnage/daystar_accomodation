require('dotenv').config();
const path = require('path');
const express = require('express');
const pool = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
// Uploaded photos: no directory listing, no dotfiles, and browsers must treat them as images only.
const { UPLOAD_DIR } = require('./middleware/upload.middleware');
app.use('/uploads', express.static(UPLOAD_DIR, {
  index: false,
  dotfiles: 'deny',
  setHeaders: (res) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Security-Policy', "default-src 'none'");
    res.set('Cache-Control', 'public, max-age=31536000, immutable');   // names are random and never reused
  },
}));

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

// Every /api request knows who is logged in (req.user), then the routes decide what that user may do.
app.use('/api', require('./middleware/auth.middleware').attachUser);
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/listings', require('./routes/listings.routes'));
app.use('/api/submissions', require('./routes/submissions.routes'));

// Broken JSON in a request body gets a clean 400 instead of an HTML error page.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body must be valid JSON.' });
  next(err);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`http://localhost:${port}`));
