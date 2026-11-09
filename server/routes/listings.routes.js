// Routes: public browsing/search and listing details (favourites come later).
const router = require('express').Router();
const listings = require('../controllers/listings.controller');

router.get('/', listings.search);
router.get('/:id', listings.details);

module.exports = router;
