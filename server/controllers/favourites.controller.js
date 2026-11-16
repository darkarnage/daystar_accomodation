// Controller: a student's favourite listings (table: favourites, one row per student + listing).
//
// Every query here uses req.user.id, the id of the student who is logged in (set by attachUser from the session cookie).
// The id is NEVER read from the URL, the query string or the request body, so one student cannot read or change
// another student's favourites by sending a different id.
const pool = require('../db');
const { COLUMNS, PUBLIC_ONLY, toJson } = require('./listings.controller');

const serverError = (res, where, err) => {
  console.error(where + ' failed:', err.message || err.code || err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
};
const validId = (text) => /^\d+$/.test(text);

// GET /api/favourites  ->  { ids, listings }
// Only the logged-in student's favourites, and only listings that are still public (approved and available).
exports.list = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ${COLUMNS} FROM favourites f JOIN listings l ON l.id = f.listing_id
       WHERE f.user_id = ? AND ${PUBLIC_ONLY} ORDER BY f.created_at DESC, l.id DESC`, [req.user.id]);
    const listings = await toJson(rows);
    res.set('Cache-Control', 'no-store');   // private to this student: never cached or shared
    res.json({ ids: listings.map((l) => l.id), listings });
  } catch (err) {
    serverError(res, 'GET /api/favourites', err);
  }
};

// PUT /api/favourites/:listingId  ->  save a listing (saving twice is fine)
exports.save = async (req, res) => {
  if (!validId(req.params.listingId)) return res.status(400).json({ error: 'listingId must be a whole number.' });
  const listingId = Number(req.params.listingId);
  try {
    const [found] = await pool.query(`SELECT l.id FROM listings l WHERE l.id = ? AND ${PUBLIC_ONLY}`, [listingId]);
    if (!found.length) return res.status(404).json({ error: 'Listing not found.' });   // cannot save a hidden listing
    await pool.query('INSERT IGNORE INTO favourites (user_id, listing_id) VALUES (?, ?)', [req.user.id, listingId]);
    res.json({ id: listingId, saved: true });
  } catch (err) {
    serverError(res, 'PUT /api/favourites/:listingId', err);
  }
};

// DELETE /api/favourites/:listingId  ->  remove it from THIS student's favourites only
exports.remove = async (req, res) => {
  if (!validId(req.params.listingId)) return res.status(400).json({ error: 'listingId must be a whole number.' });
  const listingId = Number(req.params.listingId);
  try {
    await pool.query('DELETE FROM favourites WHERE user_id = ? AND listing_id = ?', [req.user.id, listingId]);
    res.json({ id: listingId, saved: false });
  } catch (err) {
    serverError(res, 'DELETE /api/favourites/:listingId', err);
  }
};
