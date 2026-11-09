// Middleware: image upload rules (type, size, random filenames).
// Files are read into memory first and only written to uploads/ after the whole submission is valid,
// so a rejected submission never leaves a file behind.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

// Where uploaded photos live. The environment variable is only for the automated tests.
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_FILES = 5;
const MAX_BYTES = 2 * 1024 * 1024;   // 2 MB per photo

const receive = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: MAX_FILES, fields: 30, fieldSize: 20 * 1024 },
}).array('photos', MAX_FILES);

// Run multer, and turn its errors into a normal 400 answer.
function parseUpload(req, res, next) {
  if (!req.is('multipart/form-data')) return res.status(400).json({ error: 'Send the form as multipart/form-data.' });
  receive(req, res, (err) => {
    if (!err) return next();
    const message = {
      LIMIT_FILE_SIZE: 'Each photo must be under 2 MB.',
      LIMIT_FILE_COUNT: 'Choose at most 5 photos.',
      LIMIT_UNEXPECTED_FILE: 'Send photos in the "photos" field, at most 5.',
    }[err.code];
    if (message) return res.status(400).json({ errors: { photos: message } });
    if (err instanceof multer.MulterError || /multipart|boundary|Unexpected end/i.test(err.message)) {
      return res.status(400).json({ error: 'The form data could not be read.' });
    }
    next(err);
  });
}

// What kind of image is this really? Look at the first bytes of the file, not at its name or claimed type.
// Returns 'jpg', 'png' or null.
function imageKind(buffer) {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  return null;
}

// Save one photo under a random name (never the uploader's filename). Returns the relative path stored in MySQL.
async function savePhoto(buffer, kind) {
  const name = crypto.randomBytes(16).toString('hex') + '.' + kind;
  await fs.promises.writeFile(path.join(UPLOAD_DIR, name), buffer, { flag: 'wx' });   // wx: never overwrite
  return 'uploads/' + name;
}

// Delete saved photos again (used when the database step fails). Never throws.
async function removePhotos(relativePaths) {
  for (const p of relativePaths) {
    try { await fs.promises.unlink(path.join(UPLOAD_DIR, path.basename(p))); } catch { /* already gone */ }
  }
}

module.exports = { UPLOAD_DIR, MAX_FILES, parseUpload, imageKind, savePhoto, removePhotos };
