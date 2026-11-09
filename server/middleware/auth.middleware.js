// Middleware: read the login cookie and attach the logged-in user (or null) as req.user.
// req.csrfToken is the session's CSRF token (see csrf.middleware.js).
// The cookie holds a random token. The database stores only its SHA-256 hash (table: sessions).
const crypto = require('crypto');
const pool = require('../db');

const COOKIE = 'cn_session';
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

// Express has no built-in cookie reader, so find our one cookie by hand.
function readCookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

async function attachUser(req, res, next) {
  req.user = null;
  req.csrfToken = null;
  const token = readCookie(req, COOKIE);
  if (token && /^[0-9a-f]{64}$/.test(token)) {   // anything else cannot be one of our tokens
    try {
      const [rows] = await pool.query(
        `SELECT u.id, u.name, u.email, u.phone, u.role, s.csrf_token
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > NOW()`, [sha256(token)]);
      if (rows[0]) {
        const { csrf_token, ...user } = rows[0];
        req.user = user;
        req.csrfToken = csrf_token;
      }
    } catch (err) {
      console.error('Session lookup failed:', err.message);
    }
  }
  next();
}

module.exports = { attachUser, readCookie, sha256, COOKIE };
