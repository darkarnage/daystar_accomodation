// Routes: student register, student and admin login, logout, current user.
const router = require('express').Router();
const auth = require('../controllers/auth.controller');

router.post('/register', auth.register);
router.post('/login', auth.login);
router.post('/admin/login', auth.adminLogin);
router.post('/logout', auth.logout);
router.get('/me', auth.me);

module.exports = router;
