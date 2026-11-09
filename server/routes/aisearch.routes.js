// Routes: optional AI-assisted search. The normal listing search does not depend on these.
const router = require('express').Router();
const ai = require('../controllers/aisearch.controller');

router.get('/status', ai.status);
router.post('/', ai.search);

module.exports = router;
