// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminController = require('../controllers/adminController');

// Middleware pour vérifier que l'utilisateur est admin
const isAdmin = async (req, res, next) => {
    try {
        // Vérifier si l'utilisateur est admin (à adapter selon votre modèle)
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Accès non autorisé - Admin requis' });
        }
        next();
    } catch (err) {
        res.status(403).json({ error: 'Accès non autorisé' });
    }
};

// Routes admin
router.get('/stats', auth, isAdmin, adminController.getStats);
router.get('/transactions', auth, isAdmin, adminController.getTransactions);
router.get('/transactions/:id', auth, isAdmin, adminController.getTransactionById);
router.patch('/transactions/:id', auth, isAdmin, adminController.updateTransaction);
router.get('/users', auth, isAdmin, adminController.getUsers);
router.get('/settings', auth, isAdmin, adminController.getSettings);
router.patch('/settings', auth, isAdmin, adminController.updateSettings);

module.exports = router;
