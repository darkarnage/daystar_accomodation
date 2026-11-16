// Routes: a student's favourites. Students only, and every change needs the CSRF token (like the admin routes).
const router = require('express').Router();
const requireRole = require('../middleware/role.middleware');
const csrf = require('../middleware/csrf.middleware');
const favourites = require('../controllers/favourites.controller');

router.use(requireRole('student'));                                                                       // logged out = 401, admin = 403
router.use((req, res, next) => (['GET', 'HEAD'].includes(req.method) ? next() : csrf(req, res, next)));   // changes need the token

router.get('/', favourites.list);
router.put('/:listingId', favourites.save);
router.delete('/:listingId', favourites.remove);

module.exports = router;
