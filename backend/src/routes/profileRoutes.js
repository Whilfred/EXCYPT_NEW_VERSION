const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.get('/', profileController.getProfile);
router.patch('/', profileController.updateProfile);
router.post('/kyc', profileController.startKyc);

module.exports = router;
