// API checks for the public listings endpoints. Needs the server and database running (npm run dev, npm run db:up, npm run seed).
// Run with: npm test
const test = require('node:test');
const assert = require('node:assert');

const BASE = process.env.TEST_URL || 'http://localhost:3000';
const get = async (path) => {
  const res = await fetch(BASE + path);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, text, json };
};
const titles = (r) => r.json.listings.map((l) => l.title);

test('lists only approved and available listings', async () => {
  const r = await get('/api/listings');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.count, 9);
  assert.ok(r.json.listings.every((l) => l.status === 'approved' && l.availability === 'available'));
  assert.ok(!titles(r).some((t) => /Syokimau|New Bedsit|Kinanie|Luxury/.test(t)), 'taken, pending and rejected must be hidden');
});

test('never exposes owner contact details', async () => {
  const all = await get('/api/listings?limit=100');
  const one = await get('/api/listings/1');
  for (const r of [all, one]) {
    assert.ok(!/contact|phone|email|0700 000|@example\.com|Njeri|Kamau|rejection/i.test(r.text), 'response must not contain contact data');
  }
});

test('listing details', async () => {
  const r = await get('/api/listings/1');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.title, 'Sunrise Bedsit near Daystar Gate');
  assert.strictEqual(r.json.distance, 0.4);
  assert.strictEqual(r.json.amenities.length, 5);
  assert.ok(r.json.images.length >= 1 && r.json.images[0].startsWith('/assets/images/'));
});

test('hidden listings return 404 (taken, pending, rejected, missing)', async () => {
  for (const id of [7, 11, 12, 13, 9999]) assert.strictEqual((await get('/api/listings/' + id)).status, 404, 'id ' + id);
});

test('filters', async () => {
  assert.deepStrictEqual(titles(await get('/api/listings?type=hostel')), ['Athi Hostel (Women only)']);
  assert.strictEqual((await get('/api/listings?maxRent=5000')).json.count, 4);
  assert.strictEqual((await get('/api/listings?maxDist=2&amenity=Wi-Fi')).json.count, 2);
  assert.strictEqual((await get('/api/listings?amenity=Wi-Fi&amenity=Own%20bathroom')).json.count, 4);
  assert.deepStrictEqual(titles(await get('/api/listings?q=mavoko')), ['Mavoko Student Bedsit']);   // case-insensitive
  assert.strictEqual((await get('/api/listings?q=mavoko&type=hostel')).json.count, 0);
});

test('sorting and limit', async () => {
  const rent = (await get('/api/listings?sort=rent')).json.listings.map((l) => l.rent);
  assert.deepStrictEqual(rent, [...rent].sort((a, b) => a - b));
  const dist = (await get('/api/listings?sort=distance&limit=3')).json.listings.map((l) => l.distance);
  assert.deepStrictEqual(dist, [0.4, 1.2, 1.8]);
  assert.strictEqual((await get('/api/listings?limit=1')).json.count, 1);
});

test('bad input gets a 400, not a crash', async () => {
  for (const q of ['type=castle', 'maxRent=abc', 'maxRent=-5', 'maxDist=0x', 'sort=rent;DROP', 'limit=0', 'limit=500', 'limit=x', 'q=' + 'a'.repeat(101)]) {
    assert.strictEqual((await get('/api/listings?' + q)).status, 400, q);
  }
  assert.strictEqual((await get('/api/listings/abc')).status, 400);
  assert.strictEqual((await get('/api/listings/1%20OR%201=1')).status, 400);
});

test('SQL injection text is treated as plain text', async () => {
  const r = await get('/api/listings?q=' + encodeURIComponent("' OR 1=1 --"));
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.count, 0);
  const wild = await get('/api/listings?q=' + encodeURIComponent('%'));   // a literal % is not a wildcard
  assert.strictEqual(wild.json.count, 0);
});
