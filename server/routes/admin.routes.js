// Routes: admin moderation (list, approve, reject, delete).
const router = require('express').Router();
const requireRole = require('../middleware/role.middleware');
const csrf = require('../middleware/csrf.middleware');
const admin = require('../controllers/admin.controller');

router.use(requireRole('admin'));                                                          // not logged in = 401, not an admin = 403
router.use((req, res, next) => (['GET', 'HEAD'].includes(req.method) ? next() : csrf(req, res, next)));   // changes need the CSRF token

router.get('/listings', admin.list);
router.get('/listings/:id', admin.details);
router.post('/listings/:id/approve', admin.approve);
router.post('/listings/:id/reject', admin.reject);
router.delete('/listings/:id', admin.remove);

module.exports = router;
