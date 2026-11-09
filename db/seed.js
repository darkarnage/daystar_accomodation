// Seeds amenities, the admin user and the demo listings. Safe to run more than once.
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../server/db');
const DEMO_LISTINGS = require('./demo-listings');

// Must match the amenity names the frontend shows (AMENITIES in public/assets/js/main.js).
const AMENITIES = [
  'Wi-Fi', 'Water 24/7', 'Security guard', 'Fenced compound', 'Parking',
  'Furnished', 'Own bathroom', 'Kitchen', 'Backup power', 'Near matatu stage',
];

// Demo listings are only inserted when the listings table is empty, so re-running never duplicates them.
async function seedListings() {
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM listings');
  if (n > 0) return console.log(`Listings: ${n} already exist, demo listings skipped`);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const l of DEMO_LISTINGS) {
      await conn.query(
        `INSERT INTO listings (id, title, description, room_type, rent_kes, location, distance_km, availability, status,
                               rejection_reason, contact_name, contact_phone, contact_email, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [l.id, l.title, l.description, l.roomType, l.rent, l.location, l.distance, l.availability, l.status,
         l.rejectionReason, l.contact.name, l.contact.phone, l.contact.email, l.created]
      );
      for (const name of l.amenities) {
        await conn.query('INSERT INTO listing_amenities (listing_id, amenity_id) SELECT ?, id FROM amenities WHERE name = ?', [l.id, name]);
      }
      for (const [i, path] of l.images.entries()) {
        await conn.query('INSERT INTO listing_images (listing_id, file_path, is_primary) VALUES (?, ?, ?)', [l.id, path, i === 0]);
      }
    }
    await conn.commit();
    console.log(`Listings: ${DEMO_LISTINGS.length} demo listings added`);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

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
  await seedListings();
  console.log(`Amenities ready. Admin ${r.affectedRows ? 'created' : 'already exists'}: ${ADMIN_EMAIL}`);
}

main()
  .catch((e) => { console.error(e.message); process.exitCode = 1; })
  .finally(() => pool.end());
