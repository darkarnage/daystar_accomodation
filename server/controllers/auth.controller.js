// Controller: student registration, student and admin login, logout and "who am I".
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../db');
const { readCookie, sha256, COOKIE } = require('../middleware/auth.middleware');

const STUDENT_SESSION_HOURS = 7 * 24;
const ADMIN_SESSION_HOURS = 8;   // admins are logged out sooner
const COOKIE_OPTIONS = {
  httpOnly: true,                                  // JavaScript on the page cannot read the cookie
  sameSite: 'lax',                                 // not sent with cross-site POSTs
  secure: process.env.NODE_ENV === 'production',   // https only in production (localhost is plain http)
  path: '/',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(\+254|0)[17]\d{2}[\s-]?\d{3}[\s-]?\d{3}$/;

// Used when the email is unknown, so "no such user" takes as long as "wrong password".
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

// Slow down password guessing: 5 wrong passwords per IP + email, then wait 15 minutes. Kept in memory.
// (A restart clears it. Use a shared store such as the database if the server ever runs more than once.)
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const failures = new Map();
const failKey = (req, email) => req.ip + '|' + email;
function isLocked(key) {
  const f = failures.get(key);
  if (f && Date.now() - f.since > WINDOW_MS) failures.delete(key);
  return (failures.get(key)?.count || 0) >= MAX_FAILS;
}
function recordFailure(key) {
  if (failures.size > 5000) failures.clear();   // never let this grow without limit
  const f = failures.get(key) || { count: 0, since: Date.now() };
  f.count++;
  failures.set(key, f);
}

// Create a session row and set the cookie.
async function startSession(res, userId, hours) {
  const token = crypto.randomBytes(32).toString('hex');
  const csrf = crypto.randomBytes(32).toString('hex');
  await pool.query('DELETE FROM sessions WHERE expires_at < NOW()');   // tidy up old sessions
  await pool.query(
    'INSERT INTO sessions (token_hash, csrf_token, user_id, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))',
    [sha256(token), csrf, userId, hours]);
  res.cookie(COOKIE, token, { ...COOKIE_OPTIONS, maxAge: hours * 60 * 60 * 1000 });
  return csrf;
}

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role });
const isText = (v) => typeof v === 'string';

// POST /api/auth/register
exports.register = async (req, res) => {
  const b = req.body || {};
  const name = isText(b.name) ? b.name.trim() : '';
  const email = isText(b.email) ? b.email.trim().toLowerCase() : '';
  const phone = isText(b.phone) ? b.phone.trim() : '';
  const password = isText(b.password) ? b.password : '';

  const errors = {};
  if (name.length < 2 || name.length > 100) errors.name = 'Enter your full name.';
  if (!EMAIL_RE.test(email) || email.length > 255) errors.email = 'Enter a valid email address.';
  if (!PHONE_RE.test(phone)) errors.phone = 'Enter a Kenyan number like 0712 345 678.';
  if (password.length < 8) errors.password = 'Use at least 8 characters.';
  else if (Buffer.byteLength(password) > 72) errors.password = 'Use at most 72 characters.';   // bcrypt ignores the rest
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  try {
    const hash = await bcrypt.hash(password, 12);
    const [result] = await pool.query(
      "INSERT INTO users (name, email, password_hash, phone, role) VALUES (?, ?, ?, ?, 'student')",
      [name, email, hash, phone]);
    const csrfToken = await startSession(res, result.insertId, STUDENT_SESSION_HOURS);
    res.status(201).json({ user: { id: result.insertId, name, email, phone, role: 'student' }, csrfToken });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ errors: { email: 'That email is already registered.' } });
    console.error('register failed:', err.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};

// Student login and admin login are the same steps for a different role, so one function builds both.
// An admin can only log in through the admin endpoint, and a student only through the student one.
// There is no way to register as an admin: the only admin account is created by db/seed.js.
function loginFor(role, hours) {
  return async (req, res) => {
    const b = req.body || {};
    const email = isText(b.email) ? b.email.trim().toLowerCase() : '';
    const password = isText(b.password) ? b.password : '';
    if (!email || !password || password.length > 200) return res.status(400).json({ error: 'Enter your email and password.' });

    const key = role + '|' + failKey(req, email);
    if (isLocked(key)) return res.status(429).json({ error: 'Too many failed attempts. Please wait 15 minutes and try again.' });

    try {
      const [rows] = await pool.query(
        'SELECT id, name, email, phone, role, password_hash FROM users WHERE email = ? AND role = ?', [email, role]);
      const user = rows[0];
      const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
      if (!user || !ok) {
        recordFailure(key);
        // Same message for "no such email" and "wrong password", so emails cannot be guessed.
        return res.status(401).json({ error: 'Incorrect email or password.' });
      }
      failures.delete(key);
      const csrfToken = await startSession(res, user.id, hours);
      res.json({ user: publicUser(user), csrfToken });
    } catch (err) {
      console.error('login failed:', err.message);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  };
}
exports.login = loginFor('student', STUDENT_SESSION_HOURS);        // POST /api/auth/login
exports.adminLogin = loginFor('admin', ADMIN_SESSION_HOURS);       // POST /api/auth/admin/login

// POST /api/auth/logout  (deletes the session, so the old cookie stops working even if someone kept a copy)
exports.logout = async (req, res) => {
  const token = readCookie(req, COOKIE);
  try {
    if (token) await pool.query('DELETE FROM sessions WHERE token_hash = ?', [sha256(token)]);
  } catch (err) {
    console.error('logout failed:', err.message);
  }
  res.clearCookie(COOKIE, COOKIE_OPTIONS);
  res.json({ ok: true });
};

// GET /api/auth/me  ->  { user, csrfToken } or { user: null } (200 either way, so logged-out visitors see no console errors)
exports.me = (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ user: req.user ? publicUser(req.user) : null, csrfToken: req.user ? req.csrfToken : null });
};
