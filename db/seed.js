// Seeds amenities and the admin user. Safe to run more than once.
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../server/db');

// Must match the amenity names the frontend shows (AMENITIES in public/assets/js/main.js).
const AMENITIES = [
  'Wi-Fi', 'Water 24/7', 'Security guard', 'Fenced compound', 'Parking',
  'Furnished', 'Own bathroom', 'Kitchen', 'Backup power', 'Near matatu stage',
];

async function main() {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 8) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (8+ chars) in .env');
  }

  for (const name of AMENITIES) {
    await pool.query('INSERT IGNORE INTO amenities (name) VALUES (?)', [name]);
  }

  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  // IGNORE: an existing admin keeps their current password
  const [r] = await pool.query(
    `INSERT IGNORE INTO users (name, email, password_hash, phone, role)
     VALUES (?, ?, ?, '0000000000', 'admin')`,
    [ADMIN_NAME || 'Site Admin', ADMIN_EMAIL.toLowerCase(), hash]
  );
  console.log(`Amenities ready. Admin ${r.affectedRows ? 'created' : 'already exists'}: ${ADMIN_EMAIL}`);
}

main()
  .catch((e) => { console.error(e.message); process.exitCode = 1; })
  .finally(() => pool.end());
