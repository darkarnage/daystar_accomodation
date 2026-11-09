// Routes: uploaded photos, with access control (see the controller).
const router = require('express').Router();
const uploads = require('../controllers/uploads.controller');

router.get('/:name', uploads.serve);

module.exports = router;
