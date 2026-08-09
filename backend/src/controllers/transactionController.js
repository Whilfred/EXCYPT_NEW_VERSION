const { pool } = require('../config/database');
const walletModel = require('../models/walletModel');
const transactionModel = require('../models/transactionModel');
const { CRYPTO_RATES, NETWORKS_BY_CRYPTO, isValidCrypto } = require('../utils/rates');

async function list(req, res) {
    const { type } = req.query;
    const transactions = await transactionModel.listTransactions(req.user.id, type);
    res.json({ transactions });
}

async function trade(req, res) {
    const { type, crypto, network, phone, country } = req.body;
    const cryptoAmount = parseFloat(req.body.cryptoAmount);

    if (!['achat', 'vente'].includes(type)) return res.status(400).json({ error: 'Type invalide.' });
    if (!isValidCrypto(crypto)) return res.status(400).json({ error: 'Crypto invalide.' });
    if (!cryptoAmount || cryptoAmount <= 0) return res.status(400).json({ error: 'Montant invalide.' });
    if (!phone || !network || !country) return res.status(400).json({ error: 'Réseau, pays et téléphone requis.' });

    // Le montant FCFA est toujours recalculé côté serveur (ne jamais faire confiance au client)
    const fcfaAmount = Math.round(cryptoAmount * CRYPTO_RATES[crypto]);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        if (type === 'vente') {
            await walletModel.decrementBalance(client, req.user.id, crypto, cryptoAmount);
        } else {
            await walletModel.incrementBalance(client, req.user.id, crypto, cryptoAmount);
        }

        const tx = await transactionModel.createTransaction(client, req.user.id, {
            type, status: 'en_attente', crypto, cryptoAmount, fcfaAmount, network, phone, country
        });

        await client.query('COMMIT');
        res.status(201).json({ transaction: tx });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: err.message || "Erreur lors de l'opération." });
    } finally {
        client.release();
    }
}

async function convert(req, res) {
    const { fromCurrency, toCurrency } = req.body;
    const fromAmount = parseFloat(req.body.fromAmount);

    const isFromCrypto = fromCurrency !== 'FCFA';
    const isToCrypto = toCurrency !== 'FCFA';
    if (isFromCrypto && !isValidCrypto(fromCurrency)) return res.status(400).json({ error: 'Devise source invalide.' });
    if (isToCrypto && !isValidCrypto(toCurrency)) return res.status(400).json({ error: 'Devise cible invalide.' });
    if (fromCurrency === toCurrency) return res.status(400).json({ error: 'Choisissez deux devises différentes.' });
    if (!fromAmount || fromAmount <= 0) return res.status(400).json({ error: 'Montant invalide.' });

    const fcfaValue = isFromCrypto ? fromAmount * CRYPTO_RATES[fromCurrency] : fromAmount;
    const toAmount = isToCrypto ? fcfaValue / CRYPTO_RATES[toCurrency] : fcfaValue;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        if (isFromCrypto) await walletModel.decrementBalance(client, req.user.id, fromCurrency, fromAmount);
        if (isToCrypto) await walletModel.incrementBalance(client, req.user.id, toCurrency, toAmount);

        const tx = await transactionModel.createTransaction(client, req.user.id, {
            type: 'conversion', status: 'termine', fromCurrency, fromAmount, toCurrency, toAmount
        });

        await client.query('COMMIT');
        res.status(201).json({ transaction: tx });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: err.message || 'Erreur lors de la conversion.' });
    } finally {
        client.release();
    }
}

async function deposit(req, res) {
    const { crypto, network, txId } = req.body;
    const amount = req.body.amount ? parseFloat(req.body.amount) : null;

    if (!isValidCrypto(crypto)) return res.status(400).json({ error: 'Crypto invalide.' });
    if (!NETWORKS_BY_CRYPTO[crypto].includes(network)) return res.status(400).json({ error: 'Réseau invalide pour cette crypto.' });

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
        res.status(400).json({ error: err.message || "Erreur lors de l'enregistrement du dépôt." });
    } finally {
        client.release();
    }
}

async function withdraw(req, res) {
    const { crypto, network, address } = req.body;
    const amount = parseFloat(req.body.amount);

    if (!isValidCrypto(crypto)) return res.status(400).json({ error: 'Crypto invalide.' });
    if (!NETWORKS_BY_CRYPTO[crypto].includes(network)) return res.status(400).json({ error: 'Réseau invalide pour cette crypto.' });
    if (!address) return res.status(400).json({ error: 'Adresse de destination requise.' });
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Montant invalide.' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await walletModel.decrementBalance(client, req.user.id, crypto, amount); // réservé pendant la confirmation

        const tx = await transactionModel.createTransaction(client, req.user.id, {
            type: 'retrait', status: 'en_attente', crypto, cryptoAmount: amount, network, address
        });

        await client.query('COMMIT');
        res.status(201).json({ transaction: tx });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: err.message || 'Erreur lors du retrait.' });
    } finally {
        client.release();
    }
}

// TODO BACKEND : en production, confirm/cancel doivent être déclenchés par un webhook
// (confirmation blockchain via un service comme Alchemy/BlockCypher, ou callback mobile money),
// pas par un appel direct du client. Garder ces routes protégées ou les retirer du frontend public.

async function confirm(req, res) {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const tx = await transactionModel.findByIdForUpdate(client, req.user.id, id);
        if (!tx) throw new Error('Transaction introuvable.');
        if (tx.status !== 'en_attente') throw new Error('Cette transaction a déjà été traitée.');

        if (tx.type === 'depot' && tx.crypto_amount) {
            await walletModel.incrementBalance(client, req.user.id, tx.crypto, parseFloat(tx.crypto_amount));
        }

        const updated = await transactionModel.updateStatus(client, id, 'termine');
        await client.query('COMMIT');
        res.json({ transaction: updated });
    } catch (err) {
        await client.query('ROLLBACK');
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
        if (tx.status !== 'en_attente') throw new Error('Cette transaction a déjà été traitée.');

        if (tx.type === 'retrait' && tx.crypto_amount) {
            await walletModel.incrementBalance(client, req.user.id, tx.crypto, parseFloat(tx.crypto_amount)); // remboursement
        }

        const updated = await transactionModel.updateStatus(client, id, 'echoue');
        await client.query('COMMIT');
        res.json({ transaction: updated });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: err.message || "Erreur lors de l'annulation." });
    } finally {
        client.release();
    }
}

module.exports = { list, trade, convert, deposit, withdraw, confirm, cancel };
