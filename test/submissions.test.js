// Submission and image-upload checks. Needs the database running (npm run db:up, npm run seed).
// This test starts its own server on spare ports with a temporary uploads folder, so your real uploads/ is untouched.
// Test listings have titles starting "TEST-" and are deleted at the end.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const pool = require('../server/db');

const UPLOADS = fs.mkdtempSync(path.join(os.tmpdir(), 'campusnest-uploads-'));
const MAIN = { port: 3951, limit: 1000 };
const LIMITED = { port: 3952, limit: 2 };
const url = (s, p) => `http://localhost:${s.port}${p}`;
const run = Date.now();
const children = [];

// Tiny valid images.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');

function startServer(s) {
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(s.port), UPLOAD_DIR: UPLOADS, SUBMIT_LIMIT_PER_HOUR: String(s.limit) },
    stdio: 'ignore',
  });
  children.push(child);
  return (async () => {
    for (let i = 0; i < 50; i++) {
      try { if ((await fetch(url(s, '/api/listings?limit=1'))).ok) return; } catch { /* not up yet */ }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error('test server did not start');
  })();
}

const fields = (over = {}) => ({
  title: `TEST-${run} Bright bedsit`, roomType: 'bedsit', rent: '6500', distance: '1.5', location: 'Mlolongo',
  description: 'A clean test bedsit with water and Wi-Fi included.', availability: 'available',
  contactName: 'Test Owner', contactPhone: '0722 111 222', contactEmail: 'owner@example.test', ...over,
});
// Send a submission. photos: [{ data, name, type }]
async function submit(server, f, photos = [], extraField = 'photos', amenities = []) {
  const form = new FormData();
  for (const [k, v] of Object.entries(f)) if (v !== undefined) form.append(k, v);
  for (const a of amenities) form.append('amenity', a);
  for (const p of photos) form.append(extraField, new Blob([p.data], { type: p.type || 'image/png' }), p.name || 'photo.png');
  const res = await fetch(url(server, '/api/submissions'), { method: 'POST', body: form });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, json, text };
}
const listingCount = async () => (await pool.query('SELECT COUNT(*) AS n FROM listings'))[0][0].n;
const files = () => fs.readdirSync(UPLOADS);

test.before(async () => { await Promise.all([startServer(MAIN), startServer(LIMITED)]); });
test.after(async () => {
  for (const c of children) c.kill();
  await pool.query("DELETE FROM listings WHERE title LIKE 'TEST-%'");   // images and amenities go with them (ON DELETE CASCADE)
  await pool.query('ALTER TABLE listings DROP CHECK chk_test_force_fail').catch(() => {});
  fs.rmSync(UPLOADS, { recursive: true, force: true });
  await pool.end();
});

test('a valid submission with two photos is saved as pending', async () => {
  const r = await submit(MAIN, fields({ title: `TEST-${run} two photos` }), [
    { data: PNG, name: 'room.png', type: 'image/png' }, { data: JPG, name: 'kitchen.jpg', type: 'image/jpeg' }], 'photos', ['Wi-Fi', 'Kitchen']);
  assert.strictEqual(r.status, 201, r.text);
  assert.strictEqual(r.json.status, 'pending');
  const [[row]] = await pool.query('SELECT * FROM listings WHERE id = ?', [r.json.id]);
  assert.strictEqual(row.status, 'pending');
  assert.strictEqual(row.availability, 'available');
  assert.strictEqual(row.rent_kes, 6500);
  assert.strictEqual(Number(row.distance_km), 1.5);
  assert.strictEqual(row.contact_name, 'Test Owner');
  assert.strictEqual(row.contact_phone, '0722 111 222');
  assert.strictEqual(row.contact_email, 'owner@example.test');
  const [imgs] = await pool.query('SELECT file_path, is_primary FROM listing_images WHERE listing_id = ? ORDER BY id', [r.json.id]);
  assert.strictEqual(imgs.length, 2);
  assert.match(imgs[0].file_path, /^uploads\/[0-9a-f]{32}\.png$/);
  assert.match(imgs[1].file_path, /^uploads\/[0-9a-f]{32}\.jpg$/);
  assert.deepStrictEqual(imgs.map((i) => i.is_primary), [1, 0]);
  assert.ok(fs.readFileSync(path.join(UPLOADS, path.basename(imgs[0].file_path))).equals(PNG), 'file on disk matches the upload');
  const [am] = await pool.query('SELECT a.name FROM listing_amenities la JOIN amenities a ON a.id = la.amenity_id WHERE la.listing_id = ? ORDER BY a.name', [r.json.id]);
  assert.deepStrictEqual(am.map((a) => a.name), ['Kitchen', 'Wi-Fi']);
});

test('a new listing is hidden from the public until approved', async () => {
  const r = await submit(MAIN, fields({ title: `TEST-${run} hidden` }), [{ data: PNG }]);
  const id = r.json.id;
  assert.strictEqual((await fetch(url(MAIN, '/api/listings/' + id))).status, 404);
  assert.ok(!(await (await fetch(url(MAIN, '/api/listings?limit=100'))).text()).includes(`TEST-${run} hidden`));
  // Pretend an admin approved it (the real admin tools come in a later stage): now it appears with its photo.
  await pool.query("UPDATE listings SET status = 'approved' WHERE id = ?", [id]);
  const pub = await (await fetch(url(MAIN, '/api/listings/' + id))).json();
  assert.strictEqual(pub.title, `TEST-${run} hidden`);
  assert.match(pub.images[0], /^\/uploads\/[0-9a-f]{32}\.png$/);
  assert.ok(!/contact|owner@example\.test|0722/.test(JSON.stringify(pub)), 'contact stays private');
  const img = await fetch(url(MAIN, pub.images[0]));
  assert.strictEqual(img.status, 200);
  assert.strictEqual(img.headers.get('content-type'), 'image/png');
  assert.strictEqual(img.headers.get('x-content-type-options'), 'nosniff');
});

test('photos are optional', async () => {
  const r = await submit(MAIN, fields({ title: `TEST-${run} no photos` }));
  assert.strictEqual(r.status, 201);
  assert.strictEqual((await pool.query('SELECT COUNT(*) AS n FROM listing_images WHERE listing_id = ?', [r.json.id]))[0][0].n, 0);
});

test('the uploader\'s filename and claimed type are never trusted', async () => {
  const before = files().length;
  const r = await submit(MAIN, fields({ title: `TEST-${run} evil name` }), [{ data: PNG, name: '../../evil.php.jpg', type: 'image/jpeg' }]);
  assert.strictEqual(r.status, 201);
  const [[img]] = await pool.query('SELECT file_path FROM listing_images WHERE listing_id = ?', [r.json.id]);
  assert.match(img.file_path, /^uploads\/[0-9a-f]{32}\.png$/, 'extension comes from the real contents (png), not the name');
  assert.strictEqual(files().length, before + 1);
  assert.ok(!files().some((f) => /evil|php/.test(f)));
});

test('missing or wrong fields get a 400 and leave no listing and no files behind', async () => {
  const listings = await listingCount(), before = files().length;
  const empty = await submit(MAIN, {}, [{ data: PNG }]);
  assert.strictEqual(empty.status, 400);
  assert.deepStrictEqual(Object.keys(empty.json.errors).sort(),
    ['contactEmail', 'contactName', 'contactPhone', 'description', 'distance', 'location', 'rent', 'roomType', 'title']);
  const bad = {
    title: 'abc', roomType: 'castle', rent: '0', distance: '100', location: ' ', description: 'too short',
    availability: 'maybe', contactName: 'x', contactPhone: '123', contactEmail: 'nope',
  };
  for (const [field, value] of Object.entries(bad)) {
    const r = await submit(MAIN, fields({ [field]: value }), [{ data: PNG }]);
    assert.strictEqual(r.status, 400, field);
    assert.ok(r.json.errors[field], 'error reported for ' + field);
  }
  for (const rent of ['abc', '1.5', '-5', '1000001', '']) assert.strictEqual((await submit(MAIN, fields({ rent }), [{ data: PNG }])).status, 400, 'rent ' + rent);
  for (const distance of ['abc', '-1', '']) assert.strictEqual((await submit(MAIN, fields({ distance }), [{ data: PNG }])).status, 400, 'distance ' + distance);
  assert.strictEqual((await submit(MAIN, fields({ title: 'x'.repeat(151) }))).status, 400);
  assert.strictEqual((await submit(MAIN, fields({ description: 'x'.repeat(2001) }))).status, 400);
  const unknown = await submit(MAIN, fields(), [{ data: PNG }], 'photos', ['Wi-Fi', 'Helipad']);
  assert.strictEqual(unknown.status, 400); assert.ok(unknown.json.errors.amenity);
  assert.strictEqual(await listingCount(), listings, 'no listing rows were created');
  assert.strictEqual(files().length, before, 'no files were written');
});

test('invalid photos are rejected, and nothing is saved at all (no orphaned files)', async () => {
  const listings = await listingCount(), before = files().length;
  const big = Buffer.concat([JPG, Buffer.alloc(2 * 1024 * 1024)]);
  const cases = {
    'text file called .jpg': [{ data: Buffer.from('<?php echo 1; ?>'), name: 'x.jpg', type: 'image/jpeg' }],
    'GIF': [{ data: Buffer.from('GIF89a\x01\x00\x01\x00', 'binary'), name: 'a.gif', type: 'image/gif' }],
    'SVG': [{ data: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), name: 'a.svg', type: 'image/svg+xml' }],
    'empty file': [{ data: Buffer.alloc(0), name: 'empty.png' }],
    'file over 2 MB': [{ data: big, name: 'big.jpg', type: 'image/jpeg' }],
    'a bad photo after a good one': [{ data: PNG }, { data: Buffer.from('not an image'), name: 'bad.png' }],
    'six photos': Array.from({ length: 6 }, () => ({ data: PNG })),
  };
  for (const [name, photos] of Object.entries(cases)) {
    const r = await submit(MAIN, fields(), photos);
    assert.strictEqual(r.status, 400, name + ': ' + r.text);
    assert.ok(r.json.errors?.photos, name + ' reports a photos error');
  }
  const wrongName = await submit(MAIN, fields(), [{ data: PNG }], 'photo');
  assert.strictEqual(wrongName.status, 400);
  assert.strictEqual(await listingCount(), listings, 'no listing rows were created');
  assert.strictEqual(files().length, before, 'no files were written');
});

test('five photos of exactly the allowed type and size are accepted', async () => {
  const r = await submit(MAIN, fields({ title: `TEST-${run} five photos` }), Array.from({ length: 5 }, () => ({ data: JPG, name: 'a.jpg' })));
  assert.strictEqual(r.status, 201, r.text);
  assert.strictEqual((await pool.query('SELECT COUNT(*) AS n FROM listing_images WHERE listing_id = ?', [r.json.id]))[0][0].n, 5);
  const exactly2mb = Buffer.concat([JPG, Buffer.alloc(2 * 1024 * 1024 - JPG.length)]);
  assert.strictEqual((await submit(MAIN, fields({ title: `TEST-${run} 2mb` }), [{ data: exactly2mb, name: 'b.jpg' }])).status, 201);
});

test('if the database step fails, the photos already saved are deleted again', async () => {
  // A temporary CHECK rule makes the INSERT fail for one special title, after the photos were written.
  await pool.query("ALTER TABLE listings ADD CONSTRAINT chk_test_force_fail CHECK (title <> 'TEST-FORCE-FAIL')");
  try {
    const listings = await listingCount(), before = files().length;
    const r = await submit(MAIN, fields({ title: 'TEST-FORCE-FAIL' }), [{ data: PNG }, { data: JPG }]);
    assert.strictEqual(r.status, 500);
    assert.ok(!/TEST-FORCE|constraint|sql/i.test(r.text), 'no database details are leaked');
    assert.strictEqual(await listingCount(), listings, 'no listing row');
    assert.strictEqual(files().length, before, 'saved photos were removed');
  } finally {
    await pool.query('ALTER TABLE listings DROP CHECK chk_test_force_fail');
  }
});

test('uploaded files cannot be used to reach other files', async () => {
  // A photo is only served once its listing is approved and available (see the admin tests), so approve one first.
  const made = await submit(MAIN, fields({ title: `TEST-${run} file access` }), [{ data: PNG }]);
  await pool.query("UPDATE listings SET status = 'approved' WHERE id = ?", [made.json.id]);
  const [[{ file_path }]] = await pool.query('SELECT file_path FROM listing_images WHERE listing_id = ?', [made.json.id]);
  const name = path.basename(file_path);
  for (const p of ['/uploads/', '/uploads', `/uploads/..%2f..%2fpackage.json`, '/uploads/%2e%2e/package.json', '/uploads/../package.json', '/uploads/.hidden', '/uploads/nothing.png']) {
    const r = await fetch(url(MAIN, p));
    const body = await r.text();
    assert.ok(r.status >= 300 || !body.includes('"name"'), p + ' must not expose files');
    assert.notStrictEqual(r.status, 200, p);
  }
  const ok = await fetch(url(MAIN, '/uploads/' + name));
  assert.strictEqual(ok.status, 200);
  assert.match(ok.headers.get('content-security-policy'), /default-src 'none'/);
});

test('a visitor is limited to a few submissions per hour, and rejected ones do not count', async () => {
  for (let i = 0; i < 3; i++) assert.strictEqual((await submit(LIMITED, fields({ title: 'x' }))).status, 400);   // invalid: not counted
  assert.strictEqual((await submit(LIMITED, fields({ title: `TEST-${run} limit 1` }))).status, 201);
  assert.strictEqual((await submit(LIMITED, fields({ title: `TEST-${run} limit 2` }))).status, 201);
  const third = await submit(LIMITED, fields({ title: `TEST-${run} limit 3` }));
  assert.strictEqual(third.status, 429);
  assert.strictEqual((await pool.query("SELECT COUNT(*) AS n FROM listings WHERE title = ?", [`TEST-${run} limit 3`]))[0][0].n, 0);
});

test('a request that is not multipart form data gets a clean 400', async () => {
  const res = await fetch(url(MAIN, '/api/submissions'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields()) });
  assert.strictEqual(res.status, 400);
  const res2 = await fetch(url(MAIN, '/api/submissions'), { method: 'POST', headers: { 'Content-Type': 'multipart/form-data; boundary=xyz' }, body: 'garbage' });
  assert.strictEqual(res2.status, 400);
});
