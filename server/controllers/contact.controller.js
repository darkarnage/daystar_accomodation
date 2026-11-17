// Controller: public contact form (no login). Messages are only saved in the database: nothing is emailed.
const pool = require('../db');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isText = (v) => typeof v === 'string';

// Same-origin check for a public form. We cannot use the CSRF token (visitors have no login session), so instead:
// if the browser says where the request came from, it must be this site.
exports.sameOrigin = (req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    let host = null;
    try { host = new URL(origin).host; } catch { /* bad Origin header */ }
    if (host !== req.headers.host) return res.status(403).json({ error: 'Request blocked: it came from another site.' });
  }
  const site = req.headers['sec-fetch-site'];   // sent by modern browsers
  if (site && site !== 'same-origin' && site !== 'none') return res.status(403).json({ error: 'Request blocked: it came from another site.' });
  next();
};

// Stop one visitor from flooding the form: N saved messages per hour per IP (kept in memory, like the submission form).
const LIMIT = Number(process.env.CONTACT_LIMIT_PER_HOUR) || 5;
const HOUR = 60 * 60 * 1000;
const recent = new Map();   // ip -> times of recent saved messages
function recentCount(ip) {
  const times = (recent.get(ip) || []).filter((t) => Date.now() - t < HOUR);
  times.length ? recent.set(ip, times) : recent.delete(ip);
  return times.length;
}
exports.limitMessages = (req, res, next) => {
  if (recentCount(req.ip) >= LIMIT) return res.status(429).json({ error: 'Too many messages from this device. Please try again later.' });
  next();
};

// POST /api/contact  (JSON: { name, email, message })
exports.create = async (req, res) => {
  const b = req.body || {};
  const text = (k) => (isText(b[k]) ? b[k].trim() : '');
  const name = text('name'), email = text('email').toLowerCase(), message = text('message');

  const errors = {};
  if (name.length < 2 || name.length > 100) errors.name = 'Enter your name (2 to 100 characters).';
  if (!EMAIL_RE.test(email) || email.length > 255) errors.email = 'Enter a valid email address.';
  if (message.length < 10 || message.length > 3000) errors.message = 'Write your message in 10 to 3000 characters.';
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  try {
    await pool.query('INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)', [name, email, message]);
    recent.set(req.ip, [...(recent.get(req.ip) || []), Date.now()]);
    res.status(201).json({ ok: true });   // only after the database confirmed the insert
  } catch (err) {
    console.error('POST /api/contact failed:', err.message);
    res.status(500).json({ error: 'Something went wrong and your message was not saved. Please try again.' });
  }
};
