const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.get('/', settingsController.getSettings);
router.patch('/', settingsController.updateSettings);
router.post('/change-password', settingsController.changePassword);

module.exports = router;
