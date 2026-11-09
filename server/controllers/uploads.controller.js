// Controller: serve uploaded photos.
// A photo is public only while its listing is public (approved AND available). Photos of pending, rejected or taken
// listings can only be fetched by a logged-in admin. Everyone else gets 404, so hidden photos cannot even be detected.
const pool = require('../db');
const { UPLOAD_DIR } = require('../middleware/upload.middleware');

// Only names we generate are accepted: 32 hex characters + .jpg or .png. Nothing else can reach the disk.
const NAME_RE = /^[0-9a-f]{32}\.(jpg|png)$/;

exports.serve = async (req, res) => {
  const { name } = req.params;
  if (!NAME_RE.test(name)) return res.status(404).end();
  try {
    const [rows] = await pool.query(
      `SELECT l.status, l.availability FROM listing_images i JOIN listings l ON l.id = i.listing_id WHERE i.file_path = ?`,
      ['uploads/' + name]);
    if (!rows.length) return res.status(404).end();
    const isPublic = rows[0].status === 'approved' && rows[0].availability === 'available';
    if (!isPublic && req.user?.role !== 'admin') return res.status(404).end();

    res.sendFile(name, {
      root: UPLOAD_DIR,
      dotfiles: 'deny',
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'",
        'Cache-Control': isPublic ? 'public, max-age=300' : 'private, no-store',   // hidden photos are never cached
      },
    }, (err) => { if (err && !res.headersSent) res.status(404).end(); });
  } catch (err) {
    console.error('GET /uploads failed:', err.message);
    res.status(500).end();
  }
};
