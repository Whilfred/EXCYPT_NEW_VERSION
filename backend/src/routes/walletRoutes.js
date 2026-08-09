const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { authenticate } = require('../middleware/auth');

router.get('/balances', authenticate, walletController.getBalances);

module.exports = router;
