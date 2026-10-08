// controllers/adminController.js
const { pool } = require('../config/database');
const transactionModel = require('../models/transactionModel');
const walletModel = require('../models/walletModel');

// ================================================================
// STATISTIQUES
// ================================================================

async function getStats(req, res) {
    try {
        const client = await pool.connect();
        
        const result = await client.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'en_attente' THEN 1 END) as pending,
                COUNT(CASE WHEN status = 'termine' THEN 1 END) as done,
                COUNT(CASE WHEN status = 'echoue' THEN 1 END) as failed
            FROM transactions
        `);
        
        client.release();
        
        res.json({ stats: result.rows[0] });
    } catch (err) {
        console.error('🔴 [getStats] Erreur:', err.message);
        res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
    }
}

// ================================================================
// LISTE DES TRANSACTIONS
// ================================================================

async function getTransactions(req, res) {
    try {
        const { filter } = req.body || {};
        let query = `
            SELECT t.*, u.first_name, u.last_name, u.email 
            FROM transactions t
            LEFT JOIN users u ON t.user_id = u.id
        `;
        const params = [];
        
        if (filter && filter !== 'tous') {
            if (['en_attente', 'termine', 'echoue'].includes(filter)) {
                query += ` WHERE t.status = $1`;
                params.push(filter);
            } else if (['achat', 'vente', 'conversion', 'depot', 'retrait', 'retrait_fcfa'].includes(filter)) {
                query += ` WHERE t.type = $1`;
                params.push(filter);
            }
        }
        
        query += ` ORDER BY t.created_at DESC`;
        
        const client = await pool.connect();
        const result = await client.query(query, params);
        client.release();
        
        res.json({ transactions: result.rows });
    } catch (err) {
        console.error('🔴 [getTransactions] Erreur:', err.message);
        res.status(500).json({ error: 'Erreur lors de la récupération des transactions' });
    }
}

// ================================================================
// TRANSACTION PAR ID
// ================================================================

async function getTransactionById(req, res) {
    try {
        const { id } = req.params;
        
        const client = await pool.connect();
        const result = await client.query(`
            SELECT t.*, u.first_name, u.last_name, u.email 
            FROM transactions t
            LEFT JOIN users u ON t.user_id = u.id
            WHERE t.id = $1
        `, [id]);
        client.release();
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Transaction introuvable' });
        }
        
        res.json({ transaction: result.rows[0] });
    } catch (err) {
        console.error('🔴 [getTransactionById] Erreur:', err.message);
        res.status(500).json({ error: 'Erreur lors de la récupération de la transaction' });
    }
}

// ================================================================
// METTRE À JOUR UNE TRANSACTION (Confirmer/Annuler)
// ================================================================

async function updateTransaction(req, res) {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['termine', 'echoue'].includes(status)) {
        return res.status(400).json({ error: 'Statut invalide' });
    }
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Récupérer la transaction
        const txResult = await client.query(
            'SELECT * FROM transactions WHERE id = $1 FOR UPDATE',
            [id]
        );
        
        if (txResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Transaction introuvable' });
        }
        
        const tx = txResult.rows[0];
        
        if (tx.status !== 'en_attente') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Cette transaction a déjà été traitée' });
        }
        
        // Si confirmation, créditer le compte
        if (status === 'termine') {
            if (tx.type === 'achat' || tx.type === 'depot') {
                if (tx.crypto_amount) {
                    await walletModel.incrementBalance(client, tx.user_id, tx.crypto, parseFloat(tx.crypto_amount));
                }
            }
        }
        
        // Si annulation, rembourser si besoin (pour les ventes et retraits)
        if (status === 'echoue') {
            if (tx.type === 'vente' || tx.type === 'retrait') {
                if (tx.crypto_amount) {
                    await walletModel.incrementBalance(client, tx.user_id, tx.crypto, parseFloat(tx.crypto_amount));
                }
            }
            if (tx.type === 'retrait_fcfa') {
                const total = parseFloat(tx.fcfa_amount) + parseFloat(tx.fee_amount || 0);
                await walletModel.incrementBalance(client, tx.user_id, 'FCFA', total);
            }
        }
        
        // Mettre à jour le statut
        const updateResult = await client.query(
            `UPDATE transactions 
             SET status = $1, updated_at = NOW(), admin_id = $2 
             WHERE id = $3 
             RETURNING *`,
            [status, req.user.id, id]
        );
        
        await client.query('COMMIT');
        
        res.json({ 
            success: true, 
            transaction: updateResult.rows[0],
            message: status === 'termine' ? 'Transaction confirmée' : 'Transaction annulée'
        });
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('🔴 [updateTransaction] Erreur:', err.message);
        res.status(500).json({ error: err.message || 'Erreur lors de la mise à jour' });
    } finally {
        client.release();
    }
}

// ================================================================
// LISTE DES UTILISATEURS
// ================================================================

async function getUsers(req, res) {
    try {
        const client = await pool.connect();
        const result = await client.query(`
            SELECT id, first_name, last_name, email, phone, country, kyc_status, created_at
            FROM users
            ORDER BY created_at DESC
        `);
        client.release();
        
        res.json({ users: result.rows });
    } catch (err) {
        console.error('🔴 [getUsers] Erreur:', err.message);
        res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
    }
}

// ================================================================
// PARAMÈTRES
// ================================================================

async function getSettings(req, res) {
    try {
        const client = await pool.connect();
        const result = await client.query(
            'SELECT theme, language, notif_email, notif_sms, notif_push, two_factor_enabled FROM users WHERE id = $1',
            [req.user.id]
        );
        client.release();
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }
        
        const settings = result.rows[0];
        res.json({
            settings: {
                theme: settings.theme || 'dark',
                language: settings.language || 'fr',
                notifications: {
                    email: settings.notif_email,
                    sms: settings.notif_sms,
                    push: settings.notif_push
                },
                twoFactor: settings.two_factor_enabled
            }
        });
    } catch (err) {
        console.error('🔴 [getSettings] Erreur:', err.message);
        res.status(500).json({ error: 'Erreur lors de la récupération des paramètres' });
    }
}

async function updateSettings(req, res) {
    try {
        const { theme, language, notifications, twoFactor } = req.body;
        
        const client = await pool.connect();
        await client.query(
            `UPDATE users 
             SET theme = COALESCE($1, theme),
                 language = COALESCE($2, language),
                 notif_email = COALESCE($3, notif_email),
                 notif_sms = COALESCE($4, notif_sms),
                 notif_push = COALESCE($5, notif_push),
                 two_factor_enabled = COALESCE($6, two_factor_enabled),
                 updated_at = NOW()
             WHERE id = $7`,
            [
                theme || 'dark',
                language || 'fr',
                notifications?.email ?? true,
                notifications?.sms ?? true,
                notifications?.push ?? false,
                twoFactor ?? false,
                req.user.id
            ]
        );
        client.release();
        
        res.json({ success: true, message: 'Paramètres mis à jour' });
    } catch (err) {
        console.error('🔴 [updateSettings] Erreur:', err.message);
        res.status(500).json({ error: 'Erreur lors de la mise à jour des paramètres' });
    }
}

module.exports = {
    getStats,
    getTransactions,
    getTransactionById,
    updateTransaction,
    getUsers,
    getSettings,
    updateSettings
};
