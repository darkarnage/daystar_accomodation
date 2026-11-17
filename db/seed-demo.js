// npm run seed:demo: OPTIONAL sample data for development and demos. Not part of normal setup.
// Adds 13 sample listings (only if the listings table is empty) and one sample student account (development only).
// Never changes or deletes existing users or listings. Run `npm run seed` first (amenities and the admin).
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../server/db');
const DEMO_LISTINGS = require('./demo-listings');

// Demo listings are only inserted when the listings table is empty, so re-running never duplicates them.
// If they already exist, only their sample photos are refreshed (see below).
async function seedListings() {
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM listings');
  if (n > 0) {
    console.log(`Listings: ${n} already exist, sample listings skipped (nothing was changed)`);
    return;
  }
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
    console.log(`Listings: ${DEMO_LISTINGS.length} sample listings added`);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// A sample student so you can try the student side. Development only: never created in production.
async function seedDemoStudent() {
  if (process.env.NODE_ENV === 'production') return;
  const hash = await bcrypt.hash('demo-password', 12);
  const [r] = await pool.query(
    `INSERT IGNORE INTO users (name, email, password_hash, phone, role)
     VALUES ('Faith Wanjiru', 'faith@student.daystar.ac.ke', ?, '0700 000 001', 'student')`, [hash]);
  console.log(`Demo student ${r.affectedRows ? 'created' : 'already exists'}: faith@student.daystar.ac.ke (password: demo-password)`);
}

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo data is for development only: refusing to run with NODE_ENV=production.');
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM amenities');
  if (n === 0) throw new Error('Run "npm run seed" first (it creates the amenities the sample listings use).');
  await seedListings();
  await seedDemoStudent();
}

module.exports = { main };

if (require.main === module) {
  main()
    .catch((e) => { console.error(e.message); process.exitCode = 1; })
    .finally(() => pool.end());
}
