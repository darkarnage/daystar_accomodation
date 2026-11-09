// Controller: admin moderation. Every route here is behind requireRole('admin'), and every change also needs the CSRF token.
// Admins see all listings (pending, rejected, taken too) and the owner contact details.
const pool = require('../db');
const { removePhotos } = require('../middleware/upload.middleware');
const { COLUMNS, toJson } = require('./listings.controller');

const STATUSES = ['pending', 'approved', 'rejected'];
const ADMIN_COLUMNS = `${COLUMNS}, l.rejection_reason, l.contact_name, l.contact_phone, l.contact_email`;
const validId = (text) => /^\d+$/.test(text);

// Public listing JSON plus what only admins may see.
async function toAdminJson(rows) {
  const base = await toJson(rows);
  return base.map((l, i) => ({
    ...l,
    rejectionReason: rows[i].rejection_reason,
    contact: { name: rows[i].contact_name, phone: rows[i].contact_phone, email: rows[i].contact_email },
  }));
}
const serverError = (res, where, err) => {
  console.error(where + ' failed:', err.message);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
};

// GET /api/admin/listings?status=pending|approved|rejected   (no status = all)
exports.list = async (req, res) => {
  const { status } = req.query;
  if (status !== undefined && status !== '' && !STATUSES.includes(status)) {
    return res.status(400).json({ error: 'status must be pending, approved or rejected.' });
  }
  try {
    const [counts] = await pool.query('SELECT status, COUNT(*) AS n FROM listings GROUP BY status');
    const [rows] = status
      ? await pool.query(`SELECT ${ADMIN_COLUMNS} FROM listings l WHERE l.status = ? ORDER BY l.id DESC`, [status])
      : await pool.query(`SELECT ${ADMIN_COLUMNS} FROM listings l ORDER BY l.id DESC`);
    const count = Object.fromEntries(STATUSES.map((s) => [s, counts.find((c) => c.status === s)?.n || 0]));
    res.set('Cache-Control', 'no-store');
    res.json({ counts: { ...count, all: count.pending + count.approved + count.rejected }, listings: await toAdminJson(rows) });
  } catch (err) {
    serverError(res, 'GET /api/admin/listings', err);
  }
};

// GET /api/admin/listings/:id
exports.details = async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'id must be a whole number.' });
  try {
    const [rows] = await pool.query(`SELECT ${ADMIN_COLUMNS} FROM listings l WHERE l.id = ?`, [Number(req.params.id)]);
    if (!rows.length) return res.status(404).json({ error: 'Listing not found.' });
    res.set('Cache-Control', 'no-store');
    res.json((await toAdminJson(rows))[0]);
  } catch (err) {
    serverError(res, 'GET /api/admin/listings/:id', err);
  }
};

// POST /api/admin/listings/:id/approve
// Approved + available listings become public straight away.
exports.approve = async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'id must be a whole number.' });
  try {
    const [r] = await pool.query("UPDATE listings SET status = 'approved', rejection_reason = NULL WHERE id = ?", [Number(req.params.id)]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Listing not found.' });
    res.json({ id: Number(req.params.id), status: 'approved' });
  } catch (err) {
    serverError(res, 'approve', err);
  }
};

// POST /api/admin/listings/:id/reject   { reason }   (the reason is required)
exports.reject = async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'id must be a whole number.' });
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (reason.length < 5 || reason.length > 255) {
    return res.status(400).json({ errors: { reason: 'Give a short reason (5 to 255 characters).' } });
  }
  try {
    const [r] = await pool.query("UPDATE listings SET status = 'rejected', rejection_reason = ? WHERE id = ?", [reason, Number(req.params.id)]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Listing not found.' });
    res.json({ id: Number(req.params.id), status: 'rejected' });
  } catch (err) {
    serverError(res, 'reject', err);
  }
};

// DELETE /api/admin/listings/:id
// Database rows go with the listing (ON DELETE CASCADE) but image files do not, so: read the paths first,
// delete the rows, then delete each file.
exports.remove = async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'id must be a whole number.' });
  const id = Number(req.params.id);
  try {
    const [images] = await pool.query('SELECT file_path FROM listing_images WHERE listing_id = ?', [id]);
    const [r] = await pool.query('DELETE FROM listings WHERE id = ?', [id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Listing not found.' });
    // Only files in uploads/ are ours to delete (the demo listings use shared sample photos in assets/).
    await removePhotos(images.map((i) => i.file_path).filter((p) => p.startsWith('uploads/')));
    res.json({ id, deleted: true });
  } catch (err) {
    serverError(res, 'DELETE /api/admin/listings/:id', err);
  }
};
