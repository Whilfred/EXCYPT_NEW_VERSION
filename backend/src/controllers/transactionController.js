const { pool } = require('../config/database');
const walletModel = require('../models/walletModel');
const transactionModel = require('../models/transactionModel');
const {
    CRYPTO_RATES, NETWORKS_BY_CRYPTO, isValidCrypto,
    MIN_FCFA_WITHDRAWAL, computeFcfaWithdrawalFee
} = require('../utils/rates');

console.log('🟢 [transactionController] Chargement du contrôleur');

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

// Phase 1 (SebPay désactivé) : achat ET vente sont manuels, validés par un
// admin. La vente débite le wallet immédiatement. L'achat ne crédite JAMAIS
// ici — uniquement à la confirmation admin (voir confirm()).
async function trade(req, res) {
    const { type, crypto, network, phone, country } = req.body;
    const cryptoAmount = parseFloat(req.body.cryptoAmount);

    if (!['achat', 'vente'].includes(type)) {
        return res.status(400).json({ error: 'Type invalide.' });
    }
    if (!isValidCrypto(crypto)) {
        return res.status(400).json({ error: 'Crypto invalide.' });
    }
    if (!cryptoAmount || cryptoAmount <= 0) {
        return res.status(400).json({ error: 'Montant invalide.' });
    }
    if (!phone || !network || !country) {
        return res.status(400).json({ error: 'Réseau, pays et téléphone requis.' });
    }

    const fcfaAmount = Math.round(cryptoAmount * CRYPTO_RATES[crypto]);
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        if (type === 'vente') {
            await walletModel.decrementBalance(client, req.user.id, crypto, cryptoAmount);
        }

        const tx = await transactionModel.createTransaction(client, req.user.id, {
            type, status: 'en_attente', crypto, cryptoAmount, fcfaAmount, network, phone, country
        });

        await client.query('COMMIT');
        res.status(201).json({ success: true, transaction: tx });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('🔴 [trade] ERREUR:', err.message);
        res.status(400).json({ success: false, error: err.message || "Erreur lors de l'opération." });
    } finally {
        client.release();
    }
}

// Conversion — gère maintenant le FCFA comme une vraie devise stockée
// (avant : convertir crypto→FCFA ne créditait rien, et FCFA→crypto créditait
// de la crypto sans jamais débiter le FCFA. Corrigé : les deux sens
// débitent/créditent systématiquement, y compris quand FCFA est impliqué).
async function convert(req, res) {
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

    // Montants toujours recalculés côté serveur à partir des taux serveur.
    const fcfaValue = isFromCrypto ? fromAmount * CRYPTO_RATES[fromCurrency] : fromAmount;
    const toAmount = isToCrypto ? fcfaValue / CRYPTO_RATES[toCurrency] : fcfaValue;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await walletModel.decrementBalance(client, req.user.id, fromCurrency, fromAmount);
        await walletModel.incrementBalance(client, req.user.id, toCurrency, toAmount);

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

// Retrait crypto vers un portefeuille externe (blockchain).
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

// NOUVEAU : retrait du solde FCFA vers un compte Mobile Money.
// Le client saisit le montant qu'il veut RECEVOIR ; le total débité de son
// solde FCFA = montant + frais (voir computeFcfaWithdrawalFee).
async function withdrawFcfa(req, res) {
    const { network, phone, country } = req.body;
    const amount = parseFloat(req.body.amount);

    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Montant invalide.' });
    }
    if (amount < MIN_FCFA_WITHDRAWAL) {
        return res.status(400).json({ error: `Le montant minimum de retrait est de ${MIN_FCFA_WITHDRAWAL} FCFA.` });
    }
    if (!phone || !network || !country) {
        return res.status(400).json({ error: 'Réseau, pays et téléphone requis.' });
    }

    const feeAmount = computeFcfaWithdrawalFee(amount);
    const totalDebited = amount + feeAmount;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        await walletModel.decrementBalance(client, req.user.id, 'FCFA', totalDebited);

        const tx = await transactionModel.createTransaction(client, req.user.id, {
            type: 'retrait_fcfa', status: 'en_attente',
            fcfaAmount: amount, feeAmount, network, phone, country
        });

        await client.query('COMMIT');
        res.status(201).json({ transaction: tx, feeAmount, totalDebited });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('🔴 [withdrawFcfa] ERREUR:', err.message);
        res.status(400).json({ error: err.message || 'Erreur lors du retrait FCFA.' });
    } finally {
        client.release();
    }
}

// Crédite le wallet pour un dépôt OU un achat manuel confirmé par l'admin.
async function confirm(req, res) {
    const { id } = req.params;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const tx = await transactionModel.findByIdForUpdate(client, req.user.id, id);
        if (!tx) throw new Error('Transaction introuvable.');

        if (tx.status !== 'en_attente') {
            throw new Error('Cette transaction a déjà été traitée.');
        }

        if ((tx.type === 'depot' || tx.type === 'achat') && tx.crypto_amount) {
            await walletModel.incrementBalance(client, req.user.id, tx.crypto, parseFloat(tx.crypto_amount));
        }
        // retrait / retrait_fcfa / vente : déjà réglés à la création, rien
        // à créditer ici — confirmer marque juste l'opération comme faite.

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

// Rembourse le wallet pour un retrait crypto, une vente, ou un retrait FCFA
// annulé (tous débitent le wallet immédiatement à la création).
async function cancel(req, res) {
    const { id } = req.params;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const tx = await transactionModel.findByIdForUpdate(client, req.user.id, id);
        if (!tx) throw new Error('Transaction introuvable.');

        if (tx.status !== 'en_attente') {
            throw new Error('Cette transaction a déjà été traitée.');
        }

        if ((tx.type === 'retrait' || tx.type === 'vente') && tx.crypto_amount) {
            await walletModel.incrementBalance(client, req.user.id, tx.crypto, parseFloat(tx.crypto_amount));
        }
        if (tx.type === 'retrait_fcfa') {
            const total = parseFloat(tx.fcfa_amount) + parseFloat(tx.fee_amount || 0);
            await walletModel.incrementBalance(client, req.user.id, 'FCFA', total);
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

module.exports = { list, trade, convert, deposit, withdraw, withdrawFcfa, confirm, cancel };
