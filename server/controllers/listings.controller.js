// Controller: listing search and details (public) and owner contact (students only). Favourites come in a later stage.
// Public rule: only listings that are approved AND available are ever returned.
// Owner contact (contact_name/phone/email) is only selected by the protected contact endpoint at the bottom.
const pool = require('../db');

const ROOM_TYPES = ['single', 'bedsit', 'one_bedroom', 'shared', 'hostel'];

// Fixed ORDER BY choices. The user only picks a key, so no user text ever reaches the SQL.
const SORTS = {
  newest: 'l.id DESC',
  rent: 'l.rent_kes ASC, l.id DESC',
  distance: 'l.distance_km ASC, l.id DESC',
};

// Only these columns leave the server.
const COLUMNS = `l.id, l.title, l.description, l.room_type, l.rent_kes, l.location, l.distance_km,
                 l.availability, l.status, DATE_FORMAT(l.created_at, '%Y-%m-%d') AS created`;
const PUBLIC_ONLY = `l.status = 'approved' AND l.availability = 'available'`;

// Turn database rows into the JSON the frontend uses (names, images and amenities added).
async function toJson(rows) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [am] = await pool.query(
    `SELECT la.listing_id, a.name FROM listing_amenities la JOIN amenities a ON a.id = la.amenity_id
     WHERE la.listing_id IN (?) ORDER BY a.id`, [ids]);
  const [img] = await pool.query(
    'SELECT listing_id, file_path FROM listing_images WHERE listing_id IN (?) ORDER BY is_primary DESC, id', [ids]);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    roomType: r.room_type,
    rent: r.rent_kes,
    location: r.location,
    distance: Number(r.distance_km),          // DECIMAL comes back as text
    availability: r.availability,
    status: r.status,
    created: r.created,
    amenities: am.filter((a) => a.listing_id === r.id).map((a) => a.name),
    images: img.filter((i) => i.listing_id === r.id).map((i) => '/' + i.file_path),
  }));
}

// A positive number from the query string, or null if it is missing. Returns NaN if it is present but wrong.
function positive(value) {
  if (value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : NaN;
}

// GET /api/listings?q=&type=&maxRent=&maxDist=&amenity=&amenity=&sort=&limit=
exports.search = async (req, res) => {
  const { q = '', type = '', sort = 'newest' } = req.query;
  const maxRent = positive(req.query.maxRent);
  const maxDist = positive(req.query.maxDist);
  const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
  const amenities = [].concat(req.query.amenity || []);

  // Validate every input before building the query.
  if (typeof q !== 'string' || q.length > 100) return res.status(400).json({ error: 'q must be text of at most 100 characters.' });
  if (type && !ROOM_TYPES.includes(type)) return res.status(400).json({ error: 'type is not a valid room type.' });
  if (Number.isNaN(maxRent)) return res.status(400).json({ error: 'maxRent must be a positive number.' });
  if (Number.isNaN(maxDist)) return res.status(400).json({ error: 'maxDist must be a positive number.' });
  if (!Object.hasOwn(SORTS, sort)) return res.status(400).json({ error: 'sort must be newest, rent or distance.' });
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return res.status(400).json({ error: 'limit must be a whole number from 1 to 100.' });
  if (amenities.length > 10 || amenities.some((a) => typeof a !== 'string' || a.length > 50)) {
    return res.status(400).json({ error: 'amenity must be at most 10 amenity names.' });
  }

  // Every user value goes in as a ? placeholder.
  const where = [PUBLIC_ONLY];
  const values = [];
  const text = q.trim();
  if (text) {
    const like = '%' + text.replace(/[\\%_]/g, '\\$&') + '%';   // % and _ typed by the user are matched literally
    where.push('(l.title LIKE ? OR l.location LIKE ? OR l.description LIKE ?)');
    values.push(like, like, like);
  }
  if (type) { where.push('l.room_type = ?'); values.push(type); }
  if (maxRent) { where.push('l.rent_kes <= ?'); values.push(maxRent); }
  if (maxDist) { where.push('l.distance_km <= ?'); values.push(maxDist); }
  for (const name of amenities) {   // the listing must have every ticked amenity
    where.push(`EXISTS (SELECT 1 FROM listing_amenities la JOIN amenities a ON a.id = la.amenity_id
                        WHERE la.listing_id = l.id AND a.name = ?)`);
    values.push(name);
  }

  try {
    const [rows] = await pool.query(
      `SELECT ${COLUMNS} FROM listings l WHERE ${where.join(' AND ')} ORDER BY ${SORTS[sort]} LIMIT ?`,
      [...values, limit]);
    const listings = await toJson(rows);
    res.json({ count: listings.length, listings });
  } catch (err) {
    console.error('GET /api/listings failed:', err.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};

// GET /api/listings/:id  (404 for anything that is not public, so hidden listings cannot be probed)
exports.details = async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'id must be a whole number.' });
  try {
    const [rows] = await pool.query(`SELECT ${COLUMNS} FROM listings l WHERE l.id = ? AND ${PUBLIC_ONLY}`, [Number(req.params.id)]);
    if (!rows.length) return res.status(404).json({ error: 'Listing not found.' });
    res.json((await toJson(rows))[0]);
  } catch (err) {
    console.error('GET /api/listings/:id failed:', err.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};

// GET /api/listings/:id/contact  (students only: the route uses requireRole('student'))
// The only place owner contact details leave the server.
exports.contact = async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'id must be a whole number.' });
  try {
    const [rows] = await pool.query(
      `SELECT contact_name, contact_phone, contact_email FROM listings l WHERE l.id = ? AND ${PUBLIC_ONLY}`,
      [Number(req.params.id)]);
    if (!rows.length) return res.status(404).json({ error: 'Listing not found.' });
    res.set('Cache-Control', 'no-store');   // never keep contact details in a shared cache
    res.json({ name: rows[0].contact_name, phone: rows[0].contact_phone, email: rows[0].contact_email });
  } catch (err) {
    console.error('GET /api/listings/:id/contact failed:', err.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};

// Shared with the admin controller.
exports.COLUMNS = COLUMNS;
exports.toJson = toJson;
