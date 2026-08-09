// backend/src/controllers/transactionController.js

const { pool } = require('../config/database');
const walletModel = require('../models/walletModel');
const transactionModel = require('../models/transactionModel');
const { CRYPTO_RATES, NETWORKS_BY_CRYPTO, isValidCrypto } = require('../utils/rates');

console.log('🟢 [transactionController] Chargement du contrôleur');

// ============================================================
// FONCTIONS EXPORTÉES
// ============================================================

async function list(req, res) {
    try {
        const { type } = req.query;
        const transactions = await transactionModel.listTransactions(req.user.id, type);
        res.json({ transactions });
    } catch (error) {
        console.error('🔴 [list] Erreur:', error.message);
        res.status(500).json({ error: 'Erreur lors de la récupération des transactions' });
    }
}

// NOTE : cette route ne gère plus que les ventes. Les achats passent
// exclusivement par /api/payments/sebpay/collect (sebpayController), qui est
// le seul flux qui crédite le wallet UNIQUEMENT à la confirmation du webhook.
// Ne pas réintroduire de logique SebPay ici : ça a été la cause du bug où
// le solde était crédité avant même que le paiement Mobile Money soit validé.
async function trade(req, res) {
    console.log('🟢 [trade] Début');
    console.log(`🟢 [trade] Utilisateur ID: ${req.user?.id}`);
    console.log('🟢 [trade] Body reçu:', req.body);

    const { type, crypto, network, phone, country } = req.body;
    const cryptoAmount = parseFloat(req.body.cryptoAmount);

    if (type !== 'vente') {
        console.log('🔴 [trade] Type non supporté par cette route:', type);
        return res.status(400).json({
            error: "Cette route ne gère que les ventes. Pour un achat, utilisez /api/payments/sebpay/collect."
        });
    }
    if (!isValidCrypto(crypto)) {
        console.log('🔴 [trade] Crypto invalide:', crypto);
        return res.status(400).json({ error: 'Crypto invalide.' });
    }
    if (!cryptoAmount || cryptoAmount <= 0) {
        console.log('🔴 [trade] Montant invalide:', cryptoAmount);
        return res.status(400).json({ error: 'Montant invalide.' });
    }
    if (!phone || !network || !country) {
        console.log('🔴 [trade] Champs manquants - phone:', phone, 'network:', network, 'country:', country);
        return res.status(400).json({ error: 'Réseau, pays et téléphone requis.' });
    }

    const fcfaAmount = Math.round(cryptoAmount * CRYPTO_RATES[crypto]);
    console.log(`🟢 [trade] Taux: ${CRYPTO_RATES[crypto]}, Montant FCFA: ${fcfaAmount}`);

    const client = await pool.connect();
    console.log('🟢 [trade] Connexion DB établie');

    try {
        await client.query('BEGIN');
        console.log('🟢 [trade] Transaction SQL démarrée');

        // Vente : on débite le wallet tout de suite (le crypto quitte le
        // wallet immédiatement) ; le paiement FCFA au client se fait
        // manuellement / hors bande, d'où le statut 'en_attente' en attendant
        // qu'un admin confirme l'envoi du Mobile Money.
        console.log(`🟢 [trade] Débit du wallet: ${crypto} ${cryptoAmount}`);
        await walletModel.decrementBalance(client, req.user.id, crypto, cryptoAmount);

        const tx = await transactionModel.createTransaction(client, req.user.id, {
            type, status: 'en_attente', crypto, cryptoAmount, fcfaAmount, network, phone, country
        });
        console.log(`🟢 [trade] Transaction créée avec ID: ${tx.id}`);

        await client.query('COMMIT');
        console.log(`✅ [trade] Transaction ${tx.id} committée avec succès`);

        res.status(201).json({ success: true, transaction: tx });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('🔴 [trade] ERREUR:', err.message);
        res.status(400).json({ success: false, error: err.message || "Erreur lors de l'opération." });
    } finally {
        client.release();
        console.log('🟢 [trade] Connexion DB libérée');
    }
}

async function convert(req, res) {
    console.log('🟢 [convert] Début');
    const { fromCurrency, toCurrency } = req.body;
    const fromAmount = parseFloat(req.body.fromAmount);

    const isFromCrypto = fromCurrency !== 'FCFA';
    const isToCrypto = toCurrency !== 'FCFA';

    if (isFromCrypto && !isValidCrypto(fromCurrency)) {
        return res.status(400).json({ error: 'Devise source invalide.' });
    }
    if (isToCrypto && !isValidCrypto(toCurrency)) {
        return res.status(400).json({ error: 'Devise cible invalide.' });
    }
    if (fromCurrency === toCurrency) {
        return res.status(400).json({ error: 'Choisissez deux devises différentes.' });
    }
    if (!fromAmount || fromAmount <= 0) {
        return res.status(400).json({ error: 'Montant invalide.' });
    }

    const fcfaValue = isFromCrypto ? fromAmount * CRYPTO_RATES[fromCurrency] : fromAmount;
    const toAmount = isToCrypto ? fcfaValue / CRYPTO_RATES[toCurrency] : fcfaValue;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        if (isFromCrypto) {
            await walletModel.decrementBalance(client, req.user.id, fromCurrency, fromAmount);
        }
        if (isToCrypto) {
            await walletModel.incrementBalance(client, req.user.id, toCurrency, toAmount);
        }

        const tx = await transactionModel.createTransaction(client, req.user.id, {
            type: 'conversion', status: 'termine', fromCurrency, fromAmount, toCurrency, toAmount
        });

        await client.query('COMMIT');
        res.status(201).json({ transaction: tx });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('🔴 [convert] ERREUR:', err.message);
        res.status(400).json({ error: err.message || 'Erreur lors de la conversion.' });
    } finally {
        client.release();
    }
}

async function deposit(req, res) {
    const { crypto, network, txId } = req.body;
    const amount = req.body.amount ? parseFloat(req.body.amount) : null;

    if (!isValidCrypto(crypto)) {
        return res.status(400).json({ error: 'Crypto invalide.' });
    }
    if (!NETWORKS_BY_CRYPTO[crypto].includes(network)) {
        return res.status(400).json({ error: 'Réseau invalide pour cette crypto.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const tx = await transactionModel.createTransaction(client, req.user.id, {
            type: 'depot', status: 'en_attente', crypto, cryptoAmount: amount, network, txId
        });
        await client.query('COMMIT');
        res.status(201).json({ transaction: tx });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('🔴 [deposit] ERREUR:', err.message);
        res.status(400).json({ error: err.message || "Erreur lors de l'enregistrement du dépôt." });
    } finally {
        client.release();
    }
}

async function withdraw(req, res) {
    const { crypto, network, address } = req.body;
    const amount = parseFloat(req.body.amount);

    if (!isValidCrypto(crypto)) {
        return res.status(400).json({ error: 'Crypto invalide.' });
    }
    if (!NETWORKS_BY_CRYPTO[crypto].includes(network)) {
        return res.status(400).json({ error: 'Réseau invalide pour cette crypto.' });
    }
    if (!address) {
        return res.status(400).json({ error: 'Adresse de destination requise.' });
    }
    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Montant invalide.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        await walletModel.decrementBalance(client, req.user.id, crypto, amount);
        const tx = await transactionModel.createTransaction(client, req.user.id, {
            type: 'retrait', status: 'en_attente', crypto, cryptoAmount: amount, network, address
        });
        await client.query('COMMIT');
        res.status(201).json({ transaction: tx });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('🔴 [withdraw] ERREUR:', err.message);
        res.status(400).json({ error: err.message || 'Erreur lors du retrait.' });
    } finally {
        client.release();
    }
}

async function confirm(req, res) {
    const { id } = req.params;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const tx = await transactionModel.findByIdForUpdate(client, req.user.id, id);
        if (!tx) throw new Error('Transaction introuvable.');

        if (tx.status !== 'en_attente' && tx.status !== 'en_attente_paiement') {
            throw new Error('Cette transaction a déjà été traitée.');
        }

        if (tx.type === 'depot' && tx.crypto_amount) {
            await walletModel.incrementBalance(client, req.user.id, tx.crypto, parseFloat(tx.crypto_amount));
        }

        const updated = await transactionModel.updateStatus(client, id, 'termine');
        await client.query('COMMIT');
        res.json({ transaction: updated });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('🔴 [confirm] ERREUR:', err.message);
        res.status(400).json({ error: err.message || 'Erreur lors de la confirmation.' });
    } finally {
        client.release();
    }
}

async function cancel(req, res) {
    const { id } = req.params;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const tx = await transactionModel.findByIdForUpdate(client, req.user.id, id);
        if (!tx) throw new Error('Transaction introuvable.');

        if (tx.status !== 'en_attente' && tx.status !== 'en_attente_paiement') {
            throw new Error('Cette transaction a déjà été traitée.');
        }

        if (tx.type === 'retrait' && tx.crypto_amount) {
            await walletModel.incrementBalance(client, req.user.id, tx.crypto, parseFloat(tx.crypto_amount));
        }

        const updated = await transactionModel.updateStatus(client, id, 'echoue');
        await client.query('COMMIT');
        res.json({ transaction: updated });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('🔴 [cancel] ERREUR:', err.message);
        res.status(400).json({ error: err.message || "Erreur lors de l'annulation." });
    } finally {
        client.release();
    }
}

console.log('✅ [transactionController] Toutes les fonctions exportées');

module.exports = { list, trade, convert, deposit, withdraw, confirm, cancel };
