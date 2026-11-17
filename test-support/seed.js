// npm run seed:test: prepares the TEST database only: amenities, the admin from .env, and the sample listings and
// sample student that some tests read. The safety checks in testdb.js run first, so this refuses to touch anything
// but the database named by TEST_DB_NAME.
const { pool, removeUploads } = require('./testdb');
const base = require('../db/seed');
const demo = require('../db/seed-demo');

(async () => { await base.main(); await demo.main(); })()
  .catch((e) => { console.error(e.message); process.exitCode = 1; })
  .finally(() => { removeUploads(); return pool.end(); });
