// Controller: public property submission (no login). New listings always start as "pending".
const pool = require('../db');
const { imageKind, savePhoto, removePhotos } = require('../middleware/upload.middleware');

const ROOM_TYPES = ['single', 'bedsit', 'one_bedroom', 'shared', 'hostel'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(\+254|0)[17]\d{2}[\s-]?\d{3}[\s-]?\d{3}$/;
const isText = (v) => typeof v === 'string';

// Stop one visitor from flooding the form: N successful submissions per hour per IP (kept in memory).
const LIMIT = Number(process.env.SUBMIT_LIMIT_PER_HOUR) || 10;
const HOUR = 60 * 60 * 1000;
const recent = new Map();   // ip -> times of recent successful submissions
function recentCount(ip) {
  const times = (recent.get(ip) || []).filter((t) => Date.now() - t < HOUR);
  times.length ? recent.set(ip, times) : recent.delete(ip);
  return times.length;
}
exports.limitSubmissions = (req, res, next) => {
  if (recentCount(req.ip) >= LIMIT) return res.status(429).json({ error: 'Too many submissions from this device. Please try again later.' });
  next();
};

// POST /api/submissions  (multipart/form-data: the fields below plus up to 5 files in "photos")
exports.create = async (req, res) => {
  const b = req.body || {};
  const text = (name) => (isText(b[name]) ? b[name].trim() : '');
  const title = text('title'), roomType = text('roomType'), location = text('location'), description = text('description');
  const availability = text('availability') || 'available';
  const contactName = text('contactName'), contactPhone = text('contactPhone'), contactEmail = text('contactEmail').toLowerCase();
  const rent = Number(text('rent')), distance = Number(text('distance'));
  const amenities = [...new Set([].concat(b.amenity || []))];

  // ----- validate everything before touching the disk or the database -----
  const errors = {};
  if (title.length < 5 || title.length > 150) errors.title = 'Give the listing a title (5 to 150 characters).';
  if (!ROOM_TYPES.includes(roomType)) errors.roomType = 'Choose a room type.';
  if (!Number.isInteger(rent) || rent < 1 || rent > 1000000) errors.rent = 'Enter the rent as a whole number from 1 to 1,000,000.';
  if (text('distance') === '' || !Number.isFinite(distance) || distance < 0 || distance >= 100) errors.distance = 'Enter the distance in km (0 to 99.9).';
  if (!location || location.length > 150) errors.location = 'Enter the area (up to 150 characters).';
  if (description.length < 20 || description.length > 2000) errors.description = 'Describe the place in 20 to 2000 characters.';
  if (!['available', 'taken'].includes(availability)) errors.availability = 'Choose available or taken.';
  if (contactName.length < 2 || contactName.length > 100) errors.contactName = 'Enter your name or business name.';
  if (!PHONE_RE.test(contactPhone)) errors.contactPhone = 'Enter a Kenyan number like 0712 345 678.';
  if (!EMAIL_RE.test(contactEmail) || contactEmail.length > 255) errors.contactEmail = 'Enter a valid email address.';
  if (amenities.length > 20 || amenities.some((a) => !isText(a) || a.length > 50)) errors.amenity = 'Choose amenities from the list.';

  // Photos: look at the real file contents. Only JPG and PNG are allowed (multer already limited the count and size).
  const files = req.files || [];
  const kinds = files.map((f) => imageKind(f.buffer));
  if (kinds.includes(null)) errors.photos = 'Only JPG or PNG photos are allowed.';

  try {
    if (!errors.amenity && amenities.length) {   // every amenity must be one we know
      const [known] = await pool.query('SELECT id, name FROM amenities WHERE name IN (?)', [amenities]);
      if (known.length !== amenities.length) errors.amenity = 'Choose amenities from the list.';
      else amenities.splice(0, amenities.length, ...known.map((k) => k.id));   // from here on: amenity ids
    }
    if (Object.keys(errors).length) return res.status(400).json({ errors });

    // ----- save the photos, then the database rows. If the database step fails, the photos are removed again -----
    const saved = [];
    try {
      for (const [i, f] of files.entries()) saved.push(await savePhoto(f.buffer, kinds[i]));

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [result] = await conn.query(
          `INSERT INTO listings (title, description, room_type, rent_kes, location, distance_km, availability, status,
                                 contact_name, contact_phone, contact_email)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
          [title, description, roomType, rent, location, Math.round(distance * 10) / 10, availability,
           contactName, contactPhone, contactEmail]);
        const id = result.insertId;
        for (const amenityId of amenities) {
          await conn.query('INSERT INTO listing_amenities (listing_id, amenity_id) VALUES (?, ?)', [id, amenityId]);
        }
        for (const [i, p] of saved.entries()) {
          await conn.query('INSERT INTO listing_images (listing_id, file_path, is_primary) VALUES (?, ?, ?)', [id, p, i === 0]);
        }
        await conn.commit();
        recent.set(req.ip, [...(recent.get(req.ip) || []), Date.now()]);
        res.status(201).json({ id, status: 'pending' });
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    } catch (err) {
      await removePhotos(saved);   // no orphaned files
      throw err;
    }
  } catch (err) {
    console.error('POST /api/submissions failed:', err.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
