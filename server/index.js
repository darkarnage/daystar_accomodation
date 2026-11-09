require('dotenv').config();
const path = require('path');
const express = require('express');
const pool = require('./db');

const app = express();
app.use(express.json());

// These routes need to know who is logged in, so they use attachUser (the API does too, further down).
const { attachUser } = require('./middleware/auth.middleware');
// Admin pages: only for a logged-in admin (the login page is the exception). This must come before the static files.
app.use('/admin', attachUser, require('./middleware/adminpage.middleware'));
app.use(express.static(path.join(__dirname, '..', 'public')));
// Uploaded photos are served by a route that checks the listing is public (or the viewer is an admin).
app.use('/uploads', attachUser, require('./routes/uploads.routes'));

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
app.use('/api', attachUser);
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/listings', require('./routes/listings.routes'));
app.use('/api/submissions', require('./routes/submissions.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/ai-search', require('./routes/aisearch.routes'));

// Broken JSON in a request body gets a clean 400 instead of an HTML error page.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body must be valid JSON.' });
  next(err);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`http://localhost:${port}`));
