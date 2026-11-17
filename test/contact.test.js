// Contact form checks (POST /api/contact). Needs the TEST database set up and seeded (README.md, "Testing") AND the
// contact_messages table (db/schema.sql for new databases, db/migrations/001-contact-messages.sql for older ones).
// Starts its own servers on ports 3958 and 3959. Test messages use an @example.test email containing this run's unique
// id, and only those rows are deleted at the end.
const test = require('node:test');
const assert = require('node:assert');
const { pool, RUN: run, verifyTestDatabase, startServer, cleanup } = require('../test-support/testdb');

const MAIN = 'http://localhost:3958';
const LIMITED = 'http://localhost:3959';   // allows 2 messages per hour
let n = 0;
const email = () => `contact-${run}-${++n}@example.test`;
const good = (over = {}) => ({ name: 'Test Visitor', email: email(), message: 'Hello, this is a test message.', ...over });

async function send(base, body, headers = {}, raw) {
  const res = await fetch(base + '/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
    body: raw !== undefined ? raw : JSON.stringify(body) });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, text, json };
}
const rowsFor = async (addr) => (await pool.query('SELECT name, email, message FROM contact_messages WHERE email = ?', [addr]))[0];
const total = async () => (await pool.query('SELECT COUNT(*) AS n FROM contact_messages'))[0][0].n;

test.before(async () => {
  await verifyTestDatabase();
  await Promise.all([startServer(3958, { CONTACT_LIMIT_PER_HOUR: '1000' }), startServer(3959, { CONTACT_LIMIT_PER_HOUR: '2' })]);
});
test.after(async () => {
  await pool.query('DELETE FROM contact_messages WHERE email LIKE ?', [`%${run}%@example.test`]);   // only this run's rows
  await cleanup();
});

test('a valid message needs no login and is saved exactly as sent', async () => {
  const body = good({ name: '  Wanjiru Ñ 😀  ', message: "  It's a test: 'quotes', <b>tags</b> and ; DROP TABLE users; --  " });
  const r = await send(MAIN, body);
  assert.strictEqual(r.status, 201, r.text);
  assert.deepStrictEqual(r.json, { ok: true });
  const [row] = await rowsFor(body.email);
  assert.strictEqual(row.name, 'Wanjiru Ñ 😀', 'trimmed, emoji and accents kept');
  assert.strictEqual(row.message, "It's a test: 'quotes', <b>tags</b> and ; DROP TABLE users; --", 'stored as plain text through a placeholder');
});

test('email is stored in lower case', async () => {
  const e = email();
  assert.strictEqual((await send(MAIN, good({ email: e.toUpperCase() }))).status, 201);
  assert.strictEqual((await rowsFor(e)).length, 1);
});

test('every field is validated on the server, with length limits', async () => {
  const before = await total();
  const cases = [
    [{ name: 'A' }, 'name'], [{ name: 'x'.repeat(101) }, 'name'], [{ name: '   ' }, 'name'],
    [{ email: 'nope' }, 'email'], [{ email: `${'a'.repeat(250)}@example.test` }, 'email'],
    [{ message: 'too short' }, 'message'], [{ message: 'x'.repeat(3001) }, 'message'],
  ];
  for (const [over, field] of cases) {
    const r = await send(MAIN, good(over));
    assert.strictEqual(r.status, 400, field + ' ' + JSON.stringify(over).slice(0, 40));
    assert.deepStrictEqual(Object.keys(r.json.errors), [field]);
  }
  const all = await send(MAIN, { name: '', email: '', message: '' });
  assert.deepStrictEqual(Object.keys(all.json.errors).sort(), ['email', 'message', 'name']);
  assert.strictEqual(await total(), before, 'nothing was saved');
});

test('boundary lengths are accepted', async () => {
  for (const over of [{ name: 'Al' }, { name: 'x'.repeat(100) }, { message: 'x'.repeat(10) }, { message: 'x'.repeat(3000) }]) {
    assert.strictEqual((await send(MAIN, good(over))).status, 201, JSON.stringify(over).slice(0, 40));
  }
});

test('wrong types and bad bodies get a 400, not a crash', async () => {
  for (const body of [{}, { name: ['a', 'b'], email: {}, message: 5 }, { name: null, email: null, message: null }, 'text', [], null]) {
    assert.strictEqual((await send(MAIN, body)).status, 400, JSON.stringify(body));
  }
  assert.strictEqual((await send(MAIN, null, {}, '{oops')).status, 400, 'broken JSON');
  const form = await fetch(MAIN + '/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'name=Test&email=a@b.co&message=0123456789' });
  assert.strictEqual(form.status, 400, 'not JSON');
  assert.strictEqual((await fetch(MAIN + '/api/contact')).status, 404, 'GET is not a contact endpoint');
});

test('requests from another site are blocked and nothing is saved', async () => {
  const before = await total();
  for (const headers of [{ Origin: 'http://evil.example' }, { Origin: 'not a url' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    const r = await send(MAIN, good(), headers);
    assert.strictEqual(r.status, 403, JSON.stringify(headers));
  }
  assert.strictEqual(await total(), before);
  assert.strictEqual((await send(MAIN, good(), { Origin: 'http://localhost:3958', 'Sec-Fetch-Site': 'same-origin' })).status, 201, 'our own origin is allowed');
});

test('a visitor is limited to a few messages per hour; rejected ones do not count', async () => {
  for (let i = 0; i < 3; i++) assert.strictEqual((await send(LIMITED, good({ message: 'short' }))).status, 400);   // invalid: not counted
  assert.strictEqual((await send(LIMITED, good())).status, 201);
  assert.strictEqual((await send(LIMITED, good())).status, 201);
  const third = good();
  assert.strictEqual((await send(LIMITED, third)).status, 429);
  assert.strictEqual((await rowsFor(third.email)).length, 0, 'the blocked message was not saved');
});

test('the response never claims an email was sent and leaks no database details', async () => {
  const ok = await send(MAIN, good());
  assert.ok(!/email|mail|sql/i.test(ok.text), ok.text);
  const bad = await send(MAIN, good({ name: 'A' }));
  assert.ok(!/sql|table|insert/i.test(bad.text));
});
