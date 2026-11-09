// Routes: public property submission (no login).
const router = require('express').Router();
const { parseUpload } = require('../middleware/upload.middleware');
const submissions = require('../controllers/submissions.controller');

// Order matters: check the rate limit first, then read the upload, then validate and save.
router.post('/', submissions.limitSubmissions, parseUpload, submissions.create);

module.exports = router;
