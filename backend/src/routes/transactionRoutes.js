const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.get('/', transactionController.list);
router.post('/trade', transactionController.trade);
router.post('/convert', transactionController.convert);
router.post('/deposit', transactionController.deposit);
router.post('/withdraw', transactionController.withdraw);
router.post('/:id/confirm', transactionController.confirm);
router.post('/:id/cancel', transactionController.cancel);

module.exports = router;
