// Seeds the TEST database (npm run seed:test): amenities, the admin from .env and the demo listings.
// The safety checks in testdb.js run first, so this refuses to touch anything but the database named by TEST_DB_NAME.
require('./testdb');
require('../db/seed');
