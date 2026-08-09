const express = require('express');
const router = express.Router();
const sebpayController = require('../controllers/sebpayController');
const { authenticate } = require('../middleware/auth');

// Le webhook n'est PAS protégé par authenticate (SebPay n'a pas de JWT
// utilisateur) — il est sécurisé uniquement par la vérification de la
// signature HMAC à l'intérieur du contrôleur. Doit rester déclaré AVANT
// le router.use(authenticate) ci-dessous.
router.post('/webhook', sebpayController.webhook);

router.use(authenticate);
router.get('/operators', sebpayController.getOperators);
router.post('/collect', sebpayController.initiateCollection);
router.get('/collections/:id', sebpayController.getCollectionStatus);
router.post('/collections/:id/sync', sebpayController.syncCollection);

module.exports = router;
