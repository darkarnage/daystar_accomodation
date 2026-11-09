// Routes: public browsing/search and details, plus the students-only contact details (favourites come later).
const router = require('express').Router();
const listings = require('../controllers/listings.controller');
const requireRole = require('../middleware/role.middleware');

router.get('/', listings.search);
router.get('/:id', listings.details);
router.get('/:id/contact', requireRole('student'), listings.contact);

module.exports = router;
