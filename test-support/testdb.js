// Safety layer for the automated tests. Every test file that uses the database requires this FIRST.
//
// What it guarantees:
//  - The tests only ever use a SEPARATE test database, named by TEST_DB_NAME (and TEST_DB_HOST/PORT/USER/PASSWORD).
//    It refuses to run if that name is missing, does not end in "_test", or equals the normal DB_NAME.
//  - It then points DB_* (for the tests and for the servers they start) at the test database, so the normal
//    database settings from .env are never used by a test run.
//  - It never creates, drops or resets a database. You create the test database yourself (see README.md, "Testing").
//  - Every record a test run creates carries this run's unique RUN id, and cleanup() deletes only records
//    that carry it (plus the session rows the run itself inserted). Nothing else is ever deleted.
//  - Uploads go to one temporary folder created for this run, which is checked before it is removed.
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config({ quiet: true });   // fills in anything not already set; prints nothing

const ROOT = path.join(__dirname, '..');
const env = process.env;
const fail = (msg) => { throw new Error(`Refusing to run the tests: ${msg} See README.md, "Testing".`); };

// ---------- 1. the test database settings ----------
const TEST_DB = env.TEST_DB_NAME;
if (!TEST_DB) fail('TEST_DB_NAME is not set (the tests need their own database).');
if (!/^[A-Za-z0-9_]+_test$/i.test(TEST_DB)) fail(`TEST_DB_NAME "${TEST_DB}" must end in "_test".`);
if (env.DB_NAME && env.DB_NAME.toLowerCase() === TEST_DB.toLowerCase()) fail('TEST_DB_NAME is the same as DB_NAME, your normal database.');
const HOST = env.TEST_DB_HOST || '127.0.0.1';
if (!['127.0.0.1', 'localhost', '::1'].includes(HOST)) fail('TEST_DB_HOST must be this computer (127.0.0.1).');
const PORT = env.TEST_DB_PORT || '3306';
if (!/^\d{1,5}$/.test(PORT)) fail('TEST_DB_PORT must be a number.');
if (!env.TEST_DB_USER || !env.TEST_DB_PASSWORD) fail('TEST_DB_USER and TEST_DB_PASSWORD must be set.');

// From here on everything in this process, and every server it starts, uses the test database.
Object.assign(env, { DB_HOST: HOST, DB_PORT: PORT, DB_NAME: TEST_DB, DB_USER: env.TEST_DB_USER, DB_PASSWORD: env.TEST_DB_PASSWORD });
env.GEMINI_API_KEY = '';   // tests never call the real Gemini (set, not deleted: dotenv would refill a missing value from .env)
const pool = require('../server/db');

// Checked in every test file's before/after hooks, before any query changes data.
async function verifyTestDatabase() {
  const [[row]] = await pool.query('SELECT DATABASE() AS db');
  if (row.db !== TEST_DB) fail(`connected to "${row.db}" instead of "${TEST_DB}".`);
}

// ---------- 2. unique ids for this run ----------
const RUN = Date.now().toString(36) + crypto.randomBytes(4).toString('hex');   // letters and digits only
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
const sessions = new Set();                                  // token hashes of the session rows this run inserted itself
const trackSession = (token) => { sessions.add(sha(token)); };

// ---------- 3. the temporary uploads folder ----------
const REAL_UPLOADS = path.join(ROOT, 'uploads');
const UPLOADS = fs.mkdtempSync(path.join(os.tmpdir(), 'campusnest-test-'));
env.UPLOAD_DIR = UPLOADS;                                    // servers started by the tests inherit this
function checkUploadsDir() {                                 // never touch anything that is not our own temp folder
  const dir = fs.realpathSync(UPLOADS), real = path.resolve(REAL_UPLOADS);
  const inside = (a, b) => a === b || a.startsWith(b + path.sep);
  if (path.dirname(dir) !== fs.realpathSync(os.tmpdir()) || !path.basename(dir).startsWith('campusnest-test-') || inside(dir, real) || inside(real, dir)) {
    fail(`the test uploads folder ${dir} is not a private temporary folder.`);
  }
  return dir;
}
checkUploadsDir();

// ---------- 4. servers started by a test ----------
// A test server must be ours. We do not trust an HTTP answer on the port (an unrelated server there, possibly
// using your real database, could answer before our child reports that the port is taken). Instead the child
// is started with a private message channel and server/index.js sends { type: 'campusnest-ready', port, pid }
// only after ITS listen succeeded. We wait for that message from this exact child; an exit, a spawn error or a
// timeout before it is a failure.
const children = [];
function startServer(port, extraEnv = {}, stdio = ['ignore', 'ignore', 'ignore']) {
  const child = spawn(process.execPath, ['server/index.js'], { cwd: ROOT, env: { ...env, PORT: String(port), ...extraEnv }, stdio: [...stdio, 'ipc'] });
  children.push(child);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => done(new Error(`test server on port ${port} did not report ready within 10 s`)), 10000);
    const onMessage = (m) => { if (m && m.type === 'campusnest-ready' && m.pid === child.pid && m.port === Number(port)) done(null); };
    const onExit = (code, signal) => done(new Error(`test server on port ${port} stopped at start-up (code ${code ?? signal}); is the port already in use?`));
    const onError = (err) => done(new Error(`test server on port ${port} could not be started: ${err.message}`));
    function done(err) {
      clearTimeout(timer);
      child.off('message', onMessage); child.off('exit', onExit); child.off('error', onError);
      if (err) { child.kill(); reject(err); } else resolve(child);
    }
    child.on('message', onMessage); child.once('exit', onExit); child.once('error', onError);
  });
}

// ---------- 5. cleanup ----------
// Deletes only: sessions this run inserted, listings titled "TEST-...<RUN>...", students whose email contains
// <RUN> and ends in @example.test. Then removes the temporary uploads folder and closes the pool.
async function cleanup() {
  for (const c of children) c.kill();
  try {
    await verifyTestDatabase();
    if (sessions.size) await pool.query('DELETE FROM sessions WHERE token_hash IN (?)', [[...sessions]]);
    await pool.query('DELETE FROM listings WHERE title LIKE ?', [`TEST-%${RUN}%`]);   // images, amenities, favourites go with them
    await pool.query("DELETE FROM users WHERE role = 'student' AND email LIKE ?", [`%${RUN}%@example.test`]);   // their sessions and favourites go too
  } finally {
    if (fs.existsSync(UPLOADS)) fs.rmSync(checkUploadsDir(), { recursive: true, force: true });
    await pool.end();
  }
}

module.exports = { pool, RUN, UPLOADS, TEST_DB, verifyTestDatabase, trackSession, startServer, cleanup };
