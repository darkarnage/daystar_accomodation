// Admin checks: login, protection, CSRF, moderation workflow, photo access and deletion cleanup.
// Needs the database running with the seeded admin (npm run db:up, npm run seed). Starts its own server on port 3953
// with a temporary uploads folder. Test listings have titles starting "TEST-" and are deleted at the end.
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const pool = require('../server/db');

const PORT = 3953;
const BASE = `http://localhost:${PORT}`;
const UPLOADS = fs.mkdtempSync(path.join(os.tmpdir(), 'campusnest-admin-'));
const run = Date.now();
let child, adminId;

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
const files = () => fs.readdirSync(UPLOADS);

// A tiny browser: keeps the session cookie between calls. Optionally sends the CSRF token and an Origin header.
function browser({ cookie = '', csrf = '', origin } = {}) {
  const b = { cookie, csrf };
  b.call = async (method, p, body, extra = {}) => {
    const headers = { ...(b.cookie && { Cookie: b.cookie }), ...(origin && { Origin: origin }), ...extra };
    if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
    const res = await fetch(BASE + p, { method, headers, redirect: 'manual',
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) });
    const set = res.headers.get('set-cookie');
    if (set) b.cookie = set.split(';')[0].replace(/^cn_session=$/, '');
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, headers: res.headers, text, json };
  };
  b.get = (p) => b.call('GET', p);
  b.post = (p, body = {}, extra) => b.call('POST', p, body, { ...(b.csrf && { 'X-CSRF-Token': b.csrf }), ...extra });
  b.del = (p) => b.call('DELETE', p, undefined, { ...(b.csrf && { 'X-CSRF-Token': b.csrf }) });
  return b;
}

// Make a logged-in session straight in the database (fast, no password needed).
async function sessionFor(userId) {
  const token = crypto.randomBytes(32).toString('hex'), csrf = crypto.randomBytes(32).toString('hex');
  await pool.query('INSERT INTO sessions (token_hash, csrf_token, user_id, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))', [sha(token), csrf, userId]);
  return { cookie: 'cn_session=' + token, csrf };
}
const asAdmin = async (opts) => browser({ ...(await sessionFor(adminId)), ...opts });
async function asStudent() {
  const b = browser();
  const r = await b.post('/api/auth/register', { name: 'Test Student', email: `admin-test-${run}-${Math.random().toString(36).slice(2)}@example.test`, phone: '0712 345 678', password: 'password123' });
  b.csrf = r.json.csrfToken;
  return b;
}

// Submit a listing like the public form does.
async function submit(over = {}, photos = [{ data: PNG, name: 'a.png' }, { data: JPG, name: 'b.jpg' }], amenities = ['Wi-Fi']) {
  const form = new FormData();
  const f = { title: `TEST-${run} listing`, roomType: 'bedsit', rent: '6000', distance: '1.5', location: 'Mlolongo',
    description: 'A clean test bedsit with water and Wi-Fi included.', availability: 'available',
    contactName: 'Test Owner', contactPhone: '0722 111 222', contactEmail: 'owner@example.test', ...over };
  for (const [k, v] of Object.entries(f)) form.append(k, v);
  for (const a of amenities) form.append('amenity', a);
  for (const p of photos) form.append('photos', new Blob([p.data]), p.name);
  const r = await browser().call('POST', '/api/submissions', form);
  assert.strictEqual(r.status, 201, r.text);
  return r.json.id;
}
const imagePaths = async (id) => (await pool.query('SELECT file_path FROM listing_images WHERE listing_id = ? ORDER BY id', [id]))[0].map((r) => r.file_path);
const rowCount = async (table, col, id) => (await pool.query(`SELECT COUNT(*) AS n FROM ${table} WHERE ${col} = ?`, [id]))[0][0].n;

test.before(async () => {
  [[{ id: adminId }]] = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  child = spawn(process.execPath, ['server/index.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT), UPLOAD_DIR: UPLOADS, SUBMIT_LIMIT_PER_HOUR: '1000' }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(BASE + '/api/listings?limit=1')).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('test server did not start');
});
test.after(async () => {
  child.kill();
  await pool.query("DELETE FROM listings WHERE title LIKE 'TEST-%'");
  await pool.query("DELETE FROM users WHERE email LIKE '%@example.test'");
  await pool.query('DELETE FROM sessions WHERE expires_at < NOW() OR user_id NOT IN (SELECT id FROM users)');
  fs.rmSync(UPLOADS, { recursive: true, force: true });
  await pool.end();
});

// ---------- login ----------
test('admin login with the seeded account works and starts a short, safe session', async (t) => {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) return t.skip('ADMIN_EMAIL / ADMIN_PASSWORD not set in .env');
  const b = browser();
  const r = await b.post('/api/auth/admin/login', { email: process.env.ADMIN_EMAIL.toUpperCase(), password: process.env.ADMIN_PASSWORD });
  assert.strictEqual(r.status, 200, r.text);
  assert.strictEqual(r.json.user.role, 'admin');
  assert.match(r.json.csrfToken, /^[0-9a-f]{64}$/);
  assert.ok(!/password|hash/i.test(r.text));
  const flags = r.headers.get('set-cookie');
  assert.match(flags, /HttpOnly/); assert.match(flags, /SameSite=Lax/); assert.match(flags, /Max-Age=28800/);   // 8 hours
  const me = await b.get('/api/auth/me');
  assert.strictEqual(me.json.user.role, 'admin');
  assert.strictEqual(me.json.csrfToken, r.json.csrfToken);
  b.csrf = r.json.csrfToken;
  assert.strictEqual((await b.get('/api/admin/listings')).status, 200, 'the new session can use the admin API');
  const [[s]] = await pool.query('SELECT TIMESTAMPDIFF(MINUTE, NOW(), expires_at) AS m FROM sessions WHERE token_hash = ?', [sha(b.cookie.split('=')[1])]);
  assert.ok(s.m > 7 * 60 && s.m <= 8 * 60, 'database session lasts about 8 hours, not 7 days: ' + s.m + ' min');
});

test('wrong credentials, students and unknown emails cannot use the admin login', async () => {
  const student = await asStudent();
  const email = (await student.get('/api/auth/me')).json.user.email;
  for (const body of [{ email, password: 'password123' }, { email: `nobody-${run}@example.test`, password: 'whatever-123' }]) {
    const r = await browser().post('/api/auth/admin/login', body);
    assert.strictEqual(r.status, 401); assert.strictEqual(r.json.error, 'Incorrect email or password.'); assert.ok(!r.headers.get('set-cookie'));
  }
  assert.strictEqual((await browser().post('/api/auth/admin/login', { email: 'x@example.test' })).status, 400);
  // the other way round: an admin cannot use the student login
  const [[admin]] = await pool.query('SELECT email FROM users WHERE id = ?', [adminId]);
  assert.strictEqual((await browser().post('/api/auth/login', { email: admin.email, password: process.env.ADMIN_PASSWORD || 'x' })).status, 401);
});

test('five wrong admin logins lock that email', async () => {
  const email = `lock-${run}@example.test`, b = browser();
  for (let i = 0; i < 5; i++) assert.strictEqual((await b.post('/api/auth/admin/login', { email, password: 'wrong-wrong-1' })).status, 401);
  assert.strictEqual((await b.post('/api/auth/admin/login', { email, password: 'wrong-wrong-1' })).status, 429);
});

test('there is no way to register as an admin', async () => {
  const [[admin]] = await pool.query('SELECT email FROM users WHERE id = ?', [adminId]);
  const sneaky = await browser().post('/api/auth/register', { name: 'Sneaky Admin', email: `sneaky-${run}@example.test`, phone: '0712 345 678', password: 'password123', role: 'admin', isAdmin: true });
  assert.strictEqual(sneaky.status, 201);
  assert.strictEqual(sneaky.json.user.role, 'student', 'extra role field is ignored');
  assert.strictEqual((await pool.query('SELECT role FROM users WHERE email = ?', [`sneaky-${run}@example.test`]))[0][0].role, 'student');
  assert.strictEqual((await browser().post('/api/auth/register', { name: 'Copy Cat', email: admin.email, phone: '0712 345 678', password: 'password123' })).status, 409);
  assert.strictEqual((await browser().post('/api/auth/admin/register', {})).status, 404);
  assert.strictEqual((await browser().post('/api/admin/register', {})).status, 401);
});

// ---------- protection ----------
test('every admin API route needs an admin: 401 logged out, 403 for students', async () => {
  const id = await submit({ title: `TEST-${run} protect` }, []);
  const calls = [['GET', '/api/admin/listings'], ['GET', `/api/admin/listings/${id}`], ['POST', `/api/admin/listings/${id}/approve`],
    ['POST', `/api/admin/listings/${id}/reject`], ['DELETE', `/api/admin/listings/${id}`]];
  const student = await asStudent();
  for (const [m, p] of calls) {
    assert.strictEqual((await browser().call(m, p, m === 'POST' ? {} : undefined)).status, 401, 'anonymous ' + m + ' ' + p);
    assert.strictEqual((await student.call(m, p, m === 'POST' ? { reason: 'long enough reason' } : undefined, { 'X-CSRF-Token': student.csrf })).status, 403, 'student ' + m + ' ' + p);
  }
  assert.strictEqual((await pool.query('SELECT status FROM listings WHERE id = ?', [id]))[0][0].status, 'pending', 'nothing changed');
});

test('admin pages are only handed out to a logged-in admin', async () => {
  const anon = await browser().get('/admin/dashboard.html');
  assert.strictEqual(anon.status, 302);
  assert.match(anon.headers.get('location'), /^\/admin\/login\.html\?next=/);
  assert.strictEqual((await browser().get('/admin/listings.html')).status, 302);
  assert.strictEqual((await browser().get('/admin/login.html')).status, 200, 'the login page is open');
  assert.strictEqual((await (await asStudent()).get('/admin/dashboard.html')).status, 302, 'a student is sent to the login too');
  const ok = await (await asAdmin()).get('/admin/dashboard.html');
  assert.strictEqual(ok.status, 200);
  assert.match(ok.headers.get('cache-control'), /no-store/);
  assert.strictEqual((await browser().get('/')).status, 200, 'public pages stay open');
});

// ---------- CSRF ----------
test('changes need the CSRF token and a same-site origin', async () => {
  const id = await submit({ title: `TEST-${run} csrf` }, []);
  const a = await asAdmin(), approve = `/api/admin/listings/${id}/approve`;
  const status = () => pool.query('SELECT status FROM listings WHERE id = ?', [id]).then(([r]) => r[0].status);

  const noToken = browser({ cookie: a.cookie });
  assert.strictEqual((await noToken.post(approve)).status, 403, 'no token');
  assert.strictEqual((await browser({ cookie: a.cookie, csrf: 'f'.repeat(64) }).post(approve)).status, 403, 'wrong token');
  assert.strictEqual((await browser({ cookie: a.cookie, csrf: 'short' }).post(approve)).status, 403, 'token of the wrong length');
  const other = await sessionFor(adminId);
  assert.strictEqual((await browser({ cookie: a.cookie, csrf: other.csrf }).post(approve)).status, 403, 'token of a different session');
  assert.strictEqual((await browser({ cookie: a.cookie }).call('DELETE', `/api/admin/listings/${id}`)).status, 403, 'delete without token');
  assert.strictEqual((await browser({ cookie: a.cookie }).post(`/api/admin/listings/${id}/reject`, { reason: 'a valid reason' })).status, 403, 'reject without token');
  assert.strictEqual(await status(), 'pending', 'none of the blocked requests changed anything');

  assert.strictEqual((await browser({ ...a, origin: 'http://evil.example' }).post(approve)).status, 403, 'right token but another site');
  assert.strictEqual((await browser({ ...a, origin: 'null' }).post(approve)).status, 403, 'opaque origin');
  assert.strictEqual(await status(), 'pending');

  assert.strictEqual((await browser({ ...a, origin: BASE }).post(approve)).status, 200, 'right token and our own origin');
  assert.strictEqual(await status(), 'approved');
  assert.strictEqual((await noToken.get('/api/admin/listings')).status, 200, 'reading needs no token');
});

test('logging out kills the admin session and its CSRF token', async () => {
  const a = await asAdmin();
  assert.strictEqual((await a.get('/api/admin/listings')).status, 200);
  assert.strictEqual((await a.post('/api/auth/logout')).status, 200);
  const replay = browser({ cookie: 'cn_session=' + a.cookie.split('=')[1], csrf: a.csrf });
  assert.strictEqual((await replay.get('/api/admin/listings')).status, 401);
  assert.strictEqual((await replay.post('/api/admin/listings/1/approve')).status, 401);
});

// ---------- the whole moderation workflow ----------
test('submit, moderate, publish, hide and delete a listing', async () => {
  const a = await asAdmin(), student = await asStudent(), anon = browser();
  const id = await submit({ title: `TEST-${run} workflow` }, [{ data: PNG, name: 'a.png' }, { data: JPG, name: 'b.jpg' }], ['Wi-Fi', 'Kitchen']);
  const [photoA, photoB] = (await imagePaths(id)).map((p) => '/' + p);
  assert.strictEqual((await pool.query('SELECT status FROM listings WHERE id = ?', [id]))[0][0].status, 'pending');

  // 1. pending: admin sees everything, the public sees nothing
  const list = await a.get('/api/admin/listings?status=pending');
  const mine = list.json.listings.find((l) => l.id === id);
  assert.ok(mine, 'shows up in the admin pending list');
  assert.strictEqual(mine.contact.phone, '0722 111 222', 'admin sees the owner contact');
  assert.strictEqual(mine.images.length, 2);
  assert.ok(list.json.counts.pending >= 1 && list.json.counts.all >= list.json.counts.pending);
  assert.strictEqual((await anon.get('/api/listings/' + id)).status, 404);
  assert.ok(!(await anon.get('/api/listings?limit=100')).text.includes('workflow'));
  assert.strictEqual((await student.get(`/api/listings/${id}/contact`)).status, 404);

  // 2. pending photos: admins only
  assert.strictEqual((await anon.get(photoA)).status, 404, 'anonymous cannot see a pending photo');
  assert.strictEqual((await student.get(photoA)).status, 404, 'a student cannot either');
  const adminPhoto = await a.get(photoA);
  assert.strictEqual(adminPhoto.status, 200, 'the admin can');
  assert.strictEqual(adminPhoto.headers.get('content-type'), 'image/png');
  assert.match(adminPhoto.headers.get('cache-control'), /no-store/);
  assert.strictEqual(adminPhoto.headers.get('x-content-type-options'), 'nosniff');

  // 3. reject needs a reason
  assert.strictEqual((await a.post(`/api/admin/listings/${id}/reject`, {})).status, 400);
  assert.strictEqual((await a.post(`/api/admin/listings/${id}/reject`, { reason: 'no' })).status, 400);
  assert.strictEqual((await a.post(`/api/admin/listings/${id}/reject`, { reason: '   ' })).status, 400);
  assert.strictEqual((await a.post(`/api/admin/listings/${id}/reject`, { reason: 'x'.repeat(256) })).status, 400);
  assert.strictEqual((await a.post(`/api/admin/listings/${id}/reject`, { reason: ['a', 'b'] })).status, 400);
  assert.strictEqual((await pool.query('SELECT status FROM listings WHERE id = ?', [id]))[0][0].status, 'pending');
  const rej = await a.post(`/api/admin/listings/${id}/reject`, { reason: '  Photos are too dark, please resubmit.  ' });
  assert.strictEqual(rej.status, 200); assert.strictEqual(rej.json.status, 'rejected');
  const detail = await a.get('/api/admin/listings/' + id);
  assert.strictEqual(detail.json.status, 'rejected'); assert.strictEqual(detail.json.rejectionReason, 'Photos are too dark, please resubmit.');
  assert.strictEqual((await anon.get('/api/listings/' + id)).status, 404, 'rejected stays hidden');
  assert.strictEqual((await anon.get(photoA)).status, 404);
  assert.ok(!/rejection|please resubmit/i.test((await anon.get('/api/listings?limit=100')).text));

  // 4. approve: public straight away, reason cleared
  assert.strictEqual((await a.post(`/api/admin/listings/${id}/approve`)).status, 200);
  assert.strictEqual((await a.get('/api/admin/listings/' + id)).json.rejectionReason, null);
  const pub = await anon.get('/api/listings/' + id);
  assert.strictEqual(pub.status, 200); assert.strictEqual(pub.json.status, 'approved');
  assert.deepStrictEqual(pub.json.images, [photoA, photoB]);
  assert.ok((await anon.get('/api/listings?limit=100')).json.listings.some((l) => l.id === id), 'in the public list');
  assert.ok(!/owner@example\.test|0722/.test(pub.text), 'public JSON still has no contact');
  const publicPhoto = await anon.get(photoA);
  assert.strictEqual(publicPhoto.status, 200, 'photo is public now');
  assert.match(publicPhoto.headers.get('cache-control'), /public/);
  assert.strictEqual((await student.get(`/api/listings/${id}/contact`)).json.phone, '0722 111 222', 'students get the contact');
  assert.strictEqual((await a.get('/api/admin/listings?status=approved')).json.listings.some((l) => l.id === id), true);
  assert.strictEqual((await a.get('/api/admin/listings?status=pending')).json.listings.some((l) => l.id === id), false);

  // 5. delete: rows, files and public access all go
  const files0 = files().length;
  assert.strictEqual((await a.del('/api/admin/listings/' + id)).status, 200);
  assert.strictEqual(await rowCount('listings', 'id', id), 0);
  assert.strictEqual(await rowCount('listing_images', 'listing_id', id), 0);
  assert.strictEqual(await rowCount('listing_amenities', 'listing_id', id), 0);
  assert.strictEqual(files().length, files0 - 2, 'both uploaded photos were deleted from disk');
  assert.ok(![photoA, photoB].some((p) => files().includes(path.basename(p))));
  assert.strictEqual((await anon.get('/api/listings/' + id)).status, 404);
  assert.strictEqual((await anon.get(photoA)).status, 404);
  assert.strictEqual((await a.get(photoA)).status, 404, 'not even the admin: it is gone');
  assert.strictEqual((await a.del('/api/admin/listings/' + id)).status, 404, 'deleting twice');
});

test('an approved listing that is marked taken stays hidden, photos included', async () => {
  const a = await asAdmin(), anon = browser();
  const id = await submit({ title: `TEST-${run} taken`, availability: 'taken' }, [{ data: PNG, name: 'a.png' }]);
  const photo = '/' + (await imagePaths(id))[0];
  assert.strictEqual((await a.post(`/api/admin/listings/${id}/approve`)).status, 200);
  assert.strictEqual((await anon.get('/api/listings/' + id)).status, 404);
  assert.strictEqual((await anon.get(photo)).status, 404);
  assert.strictEqual((await a.get(photo)).status, 200);
  assert.strictEqual((await a.get('/api/admin/listings/' + id)).json.availability, 'taken');
});

test('deleting a listing only removes its own uploads, never shared sample photos', async () => {
  const a = await asAdmin();
  const id = await submit({ title: `TEST-${run} sample` }, [{ data: PNG, name: 'a.png' }]);
  const [upload] = await imagePaths(id);
  fs.writeFileSync(path.join(UPLOADS, 'room-bed-desk-window.jpg'), 'decoy');   // same file name as a sample photo, in the uploads folder
  await pool.query("INSERT INTO listing_images (listing_id, file_path, is_primary) VALUES (?, 'assets/images/room-bed-desk-window.jpg', 0)", [id]);
  const sample = path.join(__dirname, '..', 'public', 'assets', 'images', 'room-bed-desk-window.jpg');
  assert.ok(fs.existsSync(sample));
  assert.strictEqual((await a.del('/api/admin/listings/' + id)).status, 200);
  assert.ok(!files().includes(path.basename(upload)), 'the real upload is deleted');
  assert.ok(files().includes('room-bed-desk-window.jpg'), 'a file that only shares a name is left alone');
  assert.ok(fs.existsSync(sample), 'the shared sample photo is untouched');
});

test('bad ids, unknown ids and bad filters', async () => {
  const a = await asAdmin();
  for (const id of ['abc', '1%20OR%201=1', '-1', '1.5']) {
    assert.strictEqual((await a.get('/api/admin/listings/' + id)).status, 400, id);
    assert.strictEqual((await a.post(`/api/admin/listings/${id}/approve`)).status, 400, id);
    assert.strictEqual((await a.post(`/api/admin/listings/${id}/reject`, { reason: 'a valid reason' })).status, 400, id);
    assert.strictEqual((await a.del('/api/admin/listings/' + id)).status, 400, id);
  }
  assert.strictEqual((await a.get('/api/admin/listings/99999999')).status, 404);
  assert.strictEqual((await a.post('/api/admin/listings/99999999/approve')).status, 404);
  assert.strictEqual((await a.post('/api/admin/listings/99999999/reject', { reason: 'a valid reason' })).status, 404);
  assert.strictEqual((await a.del('/api/admin/listings/99999999')).status, 404);
  assert.strictEqual((await a.get('/api/admin/listings?status=deleted')).status, 400);
  assert.strictEqual((await a.get('/api/admin/listings?status=rejected')).json.listings.every((l) => l.status === 'rejected'), true);
});

test('the seeded demo listings are all visible to the admin, with their statuses', async () => {
  const a = await asAdmin();
  const all = (await a.get('/api/admin/listings')).json;
  const demo = all.listings.filter((l) => l.id <= 13);
  if (demo.length < 13) return;   // demo data was changed by hand: nothing to check
  assert.deepStrictEqual(['approved', 'pending', 'rejected'].map((s) => demo.filter((l) => l.status === s).length), [10, 2, 1]);
  assert.strictEqual(all.counts.all, all.listings.length);
  assert.ok(demo.find((l) => l.id === 7).availability === 'taken');
});
