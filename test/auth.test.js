// Auth and contact-privacy checks. Needs the server and database running (npm run dev, npm run db:up, npm run seed).
// Run with: npm test. Test accounts use @example.test emails and are deleted at the end.
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const pool = require('../server/db');

const BASE = process.env.TEST_URL || 'http://localhost:3000';
const run = Date.now();
let n = 0;
const uniqueEmail = () => `student-${run}-${++n}@example.test`;
const PASSWORD = 'correct-horse-1';

// A tiny browser: remembers the cn_session cookie between calls.
function browser() {
  let cookie = '';
  const call = async (method, path, body) => {
    const res = await fetch(BASE + path, {
      method,
      headers: { ...(body !== undefined && { 'Content-Type': 'application/json' }), ...(cookie && { Cookie: cookie }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0].replace(/^cn_session=$/, '');
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, headers: res.headers, text, json };
  };
  return { get: (p) => call('GET', p), post: (p, b) => call('POST', p, b === undefined ? {} : b), setCookie: (c) => { cookie = c; }, cookie: () => cookie };
}
const goodUser = (email = uniqueEmail()) => ({ name: 'Test Student', email, phone: '0712 345 678', password: PASSWORD });

test.after(async () => {
  await pool.query("DELETE FROM users WHERE email LIKE '%@example.test'");   // sessions go with them (ON DELETE CASCADE)
  await pool.end();
});

test('registration validates every field', async () => {
  const r = await browser().post('/api/auth/register', { name: 'A', email: 'nope', phone: '123', password: 'short' });
  assert.strictEqual(r.status, 400);
  assert.deepStrictEqual(Object.keys(r.json.errors).sort(), ['email', 'name', 'password', 'phone']);
  assert.strictEqual((await browser().post('/api/auth/register', { ...goodUser(), password: 'x'.repeat(73) })).status, 400);
  assert.strictEqual((await browser().post('/api/auth/register', 'not an object')).status, 400);
  assert.strictEqual((await browser().post('/api/auth/register', { name: ['a', 'b'], email: {}, phone: 1, password: null })).status, 400);
});

test('registration creates a student, hashes the password and logs in with a safe cookie', async () => {
  const b = browser(); const u = goodUser();
  const r = await b.post('/api/auth/register', u);
  assert.strictEqual(r.status, 201);
  assert.deepStrictEqual(Object.keys(r.json.user).sort(), ['email', 'id', 'name', 'phone', 'role']);
  assert.strictEqual(r.json.user.role, 'student');
  assert.ok(!/password|hash/i.test(r.text), 'response must not include any password data');
  const flags = r.headers.get('set-cookie');
  assert.match(flags, /^cn_session=[0-9a-f]{64};/);
  assert.match(flags, /HttpOnly/); assert.match(flags, /SameSite=Lax/); assert.match(flags, /Path=\//); assert.match(flags, /Max-Age=\d+/);
  const [[row]] = await pool.query('SELECT password_hash, role FROM users WHERE email = ?', [u.email]);
  assert.ok(row.password_hash.startsWith('$2') && row.password_hash !== u.password, 'password must be a bcrypt hash');
  assert.ok(await bcrypt.compare(u.password, row.password_hash));
  const cookieToken = flags.split(';')[0].split('=')[1];
  const [sess] = await pool.query('SELECT token_hash FROM sessions WHERE token_hash = ?', [crypto.createHash('sha256').update(cookieToken).digest('hex')]);
  assert.strictEqual(sess.length, 1, 'session is stored by hash');
  const [raw] = await pool.query('SELECT 1 FROM sessions WHERE token_hash = ?', [cookieToken]);
  assert.strictEqual(raw.length, 0, 'the raw cookie value must not be stored');
  assert.strictEqual((await b.get('/api/auth/me')).json.user.email, u.email);
});

test('duplicate email is rejected, ignoring case', async () => {
  const u = goodUser(); await browser().post('/api/auth/register', u);
  const r = await browser().post('/api/auth/register', { ...u, email: u.email.toUpperCase() });
  assert.strictEqual(r.status, 409);
  assert.ok(r.json.errors.email);
});

test('me: logged out is { user: null }, logged in returns the user', async () => {
  const anon = await browser().get('/api/auth/me');
  assert.strictEqual(anon.status, 200); assert.strictEqual(anon.json.user, null);
  assert.match(anon.headers.get('cache-control'), /no-store/);
});

test('login: invalid credentials all get the same 401', async () => {
  const u = goodUser(); await browser().post('/api/auth/register', u);
  const wrongPass = await browser().post('/api/auth/login', { email: u.email, password: 'wrong-password' });
  const noUser = await browser().post('/api/auth/login', { email: uniqueEmail(), password: PASSWORD });
  const [admin] = await pool.query("SELECT email FROM users WHERE role = 'admin' LIMIT 1");
  const adminTry = await browser().post('/api/auth/login', { email: admin[0].email, password: 'whatever-123' });
  for (const r of [wrongPass, noUser, adminTry]) { assert.strictEqual(r.status, 401); assert.strictEqual(r.json.error, 'Incorrect email or password.'); assert.ok(!r.headers.get('set-cookie')); }
  assert.strictEqual((await browser().post('/api/auth/login', { email: u.email })).status, 400);
  assert.strictEqual((await browser().post('/api/auth/login', { email: { $ne: 1 }, password: { $ne: 1 } })).status, 400);
});

test('login works with the right password and ignores email case', async () => {
  const u = goodUser(); await browser().post('/api/auth/register', u);
  const b = browser();
  const r = await b.post('/api/auth/login', { email: u.email.toUpperCase(), password: PASSWORD });
  assert.strictEqual(r.status, 200);
  assert.strictEqual((await b.get('/api/auth/me')).json.user.email, u.email);
});

test('five wrong passwords lock that email, then the right one is refused too', async () => {
  const u = goodUser(); await browser().post('/api/auth/register', u);
  const b = browser();
  for (let i = 0; i < 5; i++) assert.strictEqual((await b.post('/api/auth/login', { email: u.email, password: 'nope-nope-1' })).status, 401);
  assert.strictEqual((await b.post('/api/auth/login', { email: u.email, password: 'nope-nope-1' })).status, 429);
  assert.strictEqual((await b.post('/api/auth/login', { email: u.email, password: PASSWORD })).status, 429);
});

test('contact details need a student login', async () => {
  const anon = await browser().get('/api/listings/1/contact');
  assert.strictEqual(anon.status, 401);
  assert.ok(!/0700|@example\.com|Njeri/.test(anon.text));

  const b = browser(); await b.post('/api/auth/register', goodUser());
  const ok = await b.get('/api/listings/1/contact');
  assert.strictEqual(ok.status, 200);
  assert.deepStrictEqual(ok.json, { name: 'Mama Njeri Properties', phone: '0700 000 011', email: 'njeri@example.com' });
  assert.match(ok.headers.get('cache-control'), /no-store/);
});

test('contact is not available for hidden listings or bad ids', async () => {
  const b = browser(); await b.post('/api/auth/register', goodUser());
  for (const id of [7, 11, 12, 13, 9999]) assert.strictEqual((await b.get(`/api/listings/${id}/contact`)).status, 404, 'id ' + id);
  assert.strictEqual((await b.get('/api/listings/abc/contact')).status, 400);
});

test('an admin session is not allowed to use the student contact endpoint', async () => {
  const [[admin]] = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))",
    [crypto.createHash('sha256').update(token).digest('hex'), admin.id]);
  const b = browser(); b.setCookie('cn_session=' + token);
  assert.strictEqual((await b.get('/api/listings/1/contact')).status, 403);
});

test('public listing responses never contain contact details, even when logged in', async () => {
  const b = browser(); await b.post('/api/auth/register', goodUser());
  for (const path of ['/api/listings?limit=100', '/api/listings/1', '/api/auth/me']) {
    const r = await b.get(path);
    assert.ok(!/contact|0700 000|njeri@|kamau@|savannah@|achieng@/i.test(r.text), path + ' leaked contact data');
  }
});

test('logout ends the session, even for someone who kept a copy of the cookie', async () => {
  const b = browser(); await b.post('/api/auth/register', goodUser());
  const kept = b.cookie();
  assert.strictEqual((await b.get('/api/listings/1/contact')).status, 200);
  const out = await b.post('/api/auth/logout');
  assert.strictEqual(out.status, 200);
  assert.match(out.headers.get('set-cookie'), /cn_session=;/);
  const replay = browser(); replay.setCookie(kept);
  assert.strictEqual((await replay.get('/api/auth/me')).json.user, null);
  assert.strictEqual((await replay.get('/api/listings/1/contact')).status, 401);
});

test('forged, garbage and expired cookies are treated as logged out', async () => {
  for (const c of ['cn_session=' + 'a'.repeat(64), 'cn_session=garbage', 'cn_session=%E0%A4%A', 'cn_session=', 'other=1']) {
    const b = browser(); b.setCookie(c);
    assert.strictEqual((await b.get('/api/auth/me')).json.user, null, c);
    assert.strictEqual((await b.get('/api/listings/1/contact')).status, 401, c);
  }
  const b0 = browser(); await b0.post('/api/auth/register', goodUser());
  const token = b0.cookie().split('=')[1];
  await pool.query('UPDATE sessions SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE token_hash = ?', [crypto.createHash('sha256').update(token).digest('hex')]);
  assert.strictEqual((await b0.get('/api/auth/me')).json.user, null, 'expired session');
});

test('broken JSON gets a 400', async () => {
  const res = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{oops' });
  assert.strictEqual(res.status, 400);
});
