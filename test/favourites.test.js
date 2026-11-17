// Favourites checks: every student only ever sees and changes THEIR OWN favourites.
// Needs the TEST database set up and seeded (README.md, "Testing"). Test accounts have @example.test emails containing this run's unique
// id; only those are deleted at the end (their favourites go with them). The demo Faith account is never changed.
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { pool, RUN: run, verifyTestDatabase, trackSession, startServer, cleanup } = require('../test-support/testdb');

const PORT = 3955;
const BASE = `http://localhost:${PORT}`;
let n = 0;
const PASSWORD = 'password123';
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');

// A tiny browser: keeps the session cookie, and sends the CSRF token when asked.
function browser() {
  const b = { cookie: '', csrf: '', origin: undefined };
  b.call = async (method, p, body, extra = {}) => {
    const headers = { ...(b.cookie && { Cookie: b.cookie }), ...(b.origin && { Origin: b.origin }), ...extra };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(BASE + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = res.headers.get('set-cookie');
    if (set) b.cookie = set.split(';')[0].replace(/^cn_session=$/, '');
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, headers: res.headers, text, json };
  };
  const token = (extra) => ({ ...(b.csrf && { 'X-CSRF-Token': b.csrf }), ...extra });
  b.get = (p) => b.call('GET', p);
  b.post = (p, body = {}) => b.call('POST', p, body);
  b.put = (p, body, extra) => b.call('PUT', p, body, token(extra));
  b.del = (p, extra) => b.call('DELETE', p, undefined, token(extra));
  b.ids = async () => (await b.get('/api/favourites')).json.ids.slice().sort((x, y) => x - y);
  return b;
}

// Register a brand-new student account and keep its details so it can log in again later.
async function newStudent(label) {
  const b = browser();
  b.email = `fav-${label}-${run}-${++n}@example.test`;
  const r = await b.post('/api/auth/register', { name: 'Fav ' + label, email: b.email, phone: '0712 345 678', password: PASSWORD });
  assert.strictEqual(r.status, 201, r.text);
  b.csrf = r.json.csrfToken; b.id = r.json.user.id;
  return b;
}
async function logIn(email) {   // a fresh browser logging in again (new session, new token)
  const b = browser();
  const r = await b.post('/api/auth/login', { email, password: PASSWORD });
  assert.strictEqual(r.status, 200, r.text);
  b.csrf = r.json.csrfToken; b.id = r.json.user.id; b.email = email;
  return b;
}
const rows = async (userId) => (await pool.query('SELECT listing_id FROM favourites WHERE user_id = ? ORDER BY listing_id', [userId]))[0].map((r) => r.listing_id);

test.before(async () => { await verifyTestDatabase(); await startServer(PORT); });
test.after(cleanup);

test('favourites are for logged-in students only', async () => {
  const anon = browser();
  for (const [m, p] of [['GET', '/api/favourites'], ['PUT', '/api/favourites/1'], ['DELETE', '/api/favourites/1']]) assert.strictEqual((await anon.call(m, p)).status, 401, m);
  // an admin session is not a student
  const [[admin]] = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  const token = crypto.randomBytes(32).toString('hex'), csrf = crypto.randomBytes(32).toString('hex');
  trackSession(token);
  await pool.query('INSERT INTO sessions (token_hash, csrf_token, user_id, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))', [sha(token), csrf, admin.id]);
  const a = browser(); a.cookie = 'cn_session=' + token; a.csrf = csrf;
  for (const [m, p] of [['GET', '/api/favourites'], ['PUT', '/api/favourites/1'], ['DELETE', '/api/favourites/1']]) assert.strictEqual((await a.call(m, p, undefined, { 'X-CSRF-Token': csrf })).status, 403, 'admin ' + m);
});

test('account A saves two listings, account B sees none of them, then B saves a different one', async () => {
  const A = await newStudent('a'), B = await newStudent('b');
  assert.strictEqual((await A.put('/api/favourites/1')).status, 200);
  assert.strictEqual((await A.put('/api/favourites/2')).status, 200);
  assert.deepStrictEqual(await A.ids(), [1, 2]);
  const aList = (await A.get('/api/favourites')).json;
  assert.deepStrictEqual(aList.listings.map((l) => l.id).sort(), [1, 2]);
  assert.ok(aList.listings[0].title && aList.listings[0].rent, 'the favourites come back as full public listings');

  // B has never saved anything
  assert.deepStrictEqual(await B.ids(), []);
  assert.deepStrictEqual((await B.get('/api/favourites')).json.listings, []);

  // B saves a different listing; A is unaffected
  assert.strictEqual((await B.put('/api/favourites/3')).status, 200);
  assert.deepStrictEqual(await B.ids(), [3]);
  assert.deepStrictEqual(await A.ids(), [1, 2]);

  // the database agrees, row by row
  assert.deepStrictEqual(await rows(A.id), [1, 2]);
  assert.deepStrictEqual(await rows(B.id), [3]);
});

test('both accounts keep their own favourites after logging out and back in', async () => {
  const A = await newStudent('a'), B = await newStudent('b');
  await A.put('/api/favourites/1'); await A.put('/api/favourites/2'); await B.put('/api/favourites/3');
  // A logs out: the old session stops working
  assert.strictEqual((await A.post('/api/auth/logout')).status, 200);
  assert.strictEqual((await A.get('/api/favourites')).status, 401, 'a logged-out browser gets nothing');
  // A and B log in again, in new sessions
  const A2 = await logIn(A.email), B2 = await logIn(B.email);
  assert.deepStrictEqual(await A2.ids(), [1, 2]);
  assert.deepStrictEqual(await B2.ids(), [3]);
  // two sessions of the same account see the same favourites
  const A3 = await logIn(A.email);
  assert.deepStrictEqual(await A3.ids(), [1, 2]);
});

test('a student cannot read or change anyone else\'s favourites by sending another id', async () => {
  const A = await newStudent('a'), B = await newStudent('b');
  await A.put('/api/favourites/1'); await A.put('/api/favourites/2');

  // B tries to pose as A in every place an id could be sent
  const spoof = { userId: A.id, user_id: A.id, user: A.id, id: A.id };
  assert.deepStrictEqual((await B.get(`/api/favourites?userId=${A.id}&user_id=${A.id}`)).json.ids, [], 'query string is ignored');
  assert.strictEqual((await B.call('GET', '/api/favourites', undefined, { 'X-User-Id': String(A.id) })).json.ids.length, 0, 'header is ignored');
  assert.strictEqual((await B.put('/api/favourites/4', spoof, { 'X-User-Id': String(A.id) })).status, 200);
  assert.deepStrictEqual(await rows(B.id), [4], 'the favourite was saved for B...');
  assert.ok(!(await rows(A.id)).includes(4), '...and not for A');

  // B removes a listing that only A saved: A must keep it
  assert.strictEqual((await B.del('/api/favourites/1')).status, 200);
  assert.deepStrictEqual(await A.ids(), [1, 2], "B's delete did not touch A's favourites");
  assert.deepStrictEqual(await B.ids(), [4]);

  // A removes one of theirs: B is unaffected
  assert.strictEqual((await A.del('/api/favourites/2')).status, 200);
  assert.deepStrictEqual(await A.ids(), [1]);
  assert.deepStrictEqual(await B.ids(), [4]);
});

test('saving and removing are safe to repeat', async () => {
  const A = await newStudent('a');
  assert.strictEqual((await A.put('/api/favourites/5')).status, 200);
  assert.strictEqual((await A.put('/api/favourites/5')).status, 200);
  assert.deepStrictEqual(await rows(A.id), [5], 'saving twice is still one row');
  assert.strictEqual((await A.del('/api/favourites/5')).status, 200);
  assert.strictEqual((await A.del('/api/favourites/5')).status, 200, 'removing something not saved is fine');
  assert.deepStrictEqual(await rows(A.id), []);
});

test('bad ids and listings that are not public cannot be saved', async () => {
  const A = await newStudent('a');
  for (const id of ['abc', '1.5', '-1', '1%20OR%201=1']) {
    assert.strictEqual((await A.put('/api/favourites/' + id)).status, 400, 'PUT ' + id);
    assert.strictEqual((await A.del('/api/favourites/' + id)).status, 400, 'DELETE ' + id);
  }
  for (const id of [7, 11, 12, 13, 99999999]) assert.strictEqual((await A.put('/api/favourites/' + id)).status, 404, 'listing ' + id + ' is taken, pending, rejected or missing');
  assert.deepStrictEqual(await rows(A.id), [], 'nothing was saved');
});

test('changes need the CSRF token and a same-site origin', async () => {
  const A = await newStudent('a'), B = await newStudent('b');
  const noToken = browser(); noToken.cookie = A.cookie;
  assert.strictEqual((await noToken.put('/api/favourites/1')).status, 403, 'no token');
  assert.strictEqual((await noToken.del('/api/favourites/1')).status, 403, 'no token (delete)');
  const wrong = browser(); wrong.cookie = A.cookie; wrong.csrf = 'f'.repeat(64);
  assert.strictEqual((await wrong.put('/api/favourites/1')).status, 403, 'wrong token');
  const others = browser(); others.cookie = A.cookie; others.csrf = B.csrf;
  assert.strictEqual((await others.put('/api/favourites/1')).status, 403, "another student's token");
  const evil = browser(); evil.cookie = A.cookie; evil.csrf = A.csrf; evil.origin = 'http://evil.example';
  assert.strictEqual((await evil.put('/api/favourites/1')).status, 403, 'right token but another site');
  assert.deepStrictEqual(await rows(A.id), [], 'none of the blocked requests changed anything');
  assert.strictEqual((await noToken.get('/api/favourites')).status, 200, 'reading needs no token');
  const ok = browser(); ok.cookie = A.cookie; ok.csrf = A.csrf; ok.origin = BASE;
  assert.strictEqual((await ok.put('/api/favourites/1')).status, 200, 'right token and our own origin');
});

test('a favourite disappears while its listing is hidden and comes back when it is public again', async () => {
  const A = await newStudent('a');
  const [r] = await pool.query(
    `INSERT INTO listings (title, description, room_type, rent_kes, location, distance_km, availability, status, contact_name, contact_phone, contact_email)
     VALUES (?, 'A test listing used by the favourites tests.', 'bedsit', 5000, 'Test', 1.0, 'available', 'approved', 'T', '0700 000 000', 't@example.test')`, [`TEST-${run} fav`]);
  const id = r.insertId;
  assert.strictEqual((await A.put('/api/favourites/' + id)).status, 200);
  assert.ok((await A.ids()).includes(id));
  await pool.query("UPDATE listings SET availability = 'taken' WHERE id = ?", [id]);
  assert.ok(!(await A.ids()).includes(id), 'taken: not shown');
  assert.ok(!(await A.get('/api/favourites')).json.listings.some((l) => l.id === id));
  await pool.query("UPDATE listings SET availability = 'available', status = 'rejected' WHERE id = ?", [id]);
  assert.ok(!(await A.ids()).includes(id), 'rejected: not shown');
  await pool.query("UPDATE listings SET status = 'approved' WHERE id = ?", [id]);
  assert.ok((await A.ids()).includes(id), 'public again: back in the list (the row was never lost)');
  await pool.query('DELETE FROM listings WHERE id = ?', [id]);
  assert.strictEqual((await pool.query('SELECT COUNT(*) AS n FROM favourites WHERE listing_id = ?', [id]))[0][0].n, 0, 'deleting a listing removes its favourites');
});

test('favourites responses are private and carry no owner contact details', async () => {
  const A = await newStudent('a');
  await A.put('/api/favourites/1');
  const r = await A.get('/api/favourites');
  assert.match(r.headers.get('cache-control'), /no-store/);
  assert.ok(!/contact|phone|email|0700 000|@example\.com|njeri/i.test(r.text), 'no contact details in the favourites response');
});

test('the demo Faith account is left exactly as it was', async () => {
  const [[faith]] = await pool.query("SELECT id FROM users WHERE email = 'faith@student.daystar.ac.ke'");
  if (!faith) return;   // the demo account is not seeded here: nothing to protect
  const before = JSON.stringify(await rows(faith.id));
  const A = await newStudent('a');
  await A.put('/api/favourites/1'); await A.del('/api/favourites/1');
  assert.strictEqual(JSON.stringify(await rows(faith.id)), before, "Faith's favourites are unchanged by other students");
  assert.strictEqual((await pool.query('SELECT COUNT(*) AS n FROM users WHERE id = ?', [faith.id]))[0][0].n, 1, 'the Faith account still exists');
});
