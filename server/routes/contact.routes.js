// Routes: public contact form (no login, no session CSRF token).
const router = require('express').Router();
const contact = require('../controllers/contact.controller');

// Order matters: same-origin check, then the rate limit, then validate and save.
router.post('/', contact.sameOrigin, contact.limitMessages, contact.create);

module.exports = router;
