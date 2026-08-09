const { pool } = require('../config/database');
const walletModel = require('../models/walletModel');
const transactionModel = require('../models/transactionModel');
const sebpay = require('../utils/sebpay');
const { CRYPTO_RATES, isValidCrypto } = require('../utils/rates');

// Proxy vers GET /operators : évite d'exposer les clés SebPay au frontend.
async function getOperators(req, res) {
    try {
        const { country } = req.query;
        const operators = await sebpay.getOperators(country);
        res.json({ operators });
    } catch (err) {
        res.status(502).json({ error: err.message || 'Impossible de récupérer les opérateurs SebPay.' });
    }
}

async function initiateCollection(req, res) {
    const { phone, operator, operatorName, country, otpCode } = req.body;
    const crypto = req.body.crypto;
    const cryptoAmount = parseFloat(req.body.cryptoAmount);

    if (!isValidCrypto(crypto)) return res.status(400).json({ error: 'Crypto invalide.' });
    if (!cryptoAmount || cryptoAmount <= 0) return res.status(400).json({ error: 'Montant invalide.' });
    if (!phone || !operator || !country) {
        return res.status(400).json({ error: 'Téléphone, opérateur et pays requis.' });
    }

    // Le montant FCFA est toujours recalculé côté serveur (ne jamais faire confiance au client).
    const fcfaAmount = Math.round(cryptoAmount * CRYPTO_RATES[crypto]);

    // Étape 1 : créer la transaction en base AVANT d'appeler SebPay, pour disposer d'un
    // identifiant interne à utiliser comme external_reference. Aucun crédit de solde ici —
    // contrairement au flux manuel, le solde n'est crédité qu'à la confirmation du webhook.
    let tx = await transactionModel.createTransaction(null, req.user.id, {
        type: 'achat',
        status: 'en_attente',
        crypto,
        cryptoAmount,
        fcfaAmount,
        network: operatorName || operator,
        phone,
        country,
        paymentMethod: 'sebpay',
        operatorSlug: operator
    });

    try {
        if (!process.env.APP_BASE_URL) {
            throw new Error('APP_BASE_URL non configuré côté serveur.');
        }

        const collection = await sebpay.initiateCollection({
            amount: fcfaAmount,
            currency: 'XOF',
            phone,
            operator,
            country,
            external_reference: String(tx.id),
            callback_url: `${process.env.APP_BASE_URL}/api/payments/sebpay/webhook`,
            ...(otpCode ? { otp_code: otpCode } : {})
        });

        tx = await transactionModel.updatePaymentProviderInfo(tx.id, {
            providerTransactionId: collection.transaction_id,
            providerLink: collection.provider_link || null
        });

        res.status(201).json({
            transaction: tx,
            providerLink: collection.provider_link || null,
            message: collection.message
        });
    } catch (err) {
        // L'appel SebPay a échoué avant même l'envoi de la demande de paiement :
        // on marque la transaction comme échouée plutôt que de la laisser
        // en_attente indéfiniment sans qu'aucune requête n'ait réellement abouti.
        await transactionModel.updateStatus(null, tx.id, 'echoue');
        res.status(502).json({ error: err.message || "Erreur lors de l'initiation du paiement SebPay." });
    }
}

async function getCollectionStatus(req, res) {
    const { id } = req.params;
    const tx = await transactionModel.findByIdForUser(req.user.id, id);
    if (!tx) return res.status(404).json({ error: 'Transaction introuvable.' });
    res.json({ transaction: tx });
}

// Filet de sécurité si le webhook n'arrive jamais (souci réseau, panne temporaire, etc.).
// Interroge directement SebPay pour resynchroniser le statut réel de la transaction.
async function syncCollection(req, res) {
    const { id } = req.params;
    const tx = await transactionModel.findByIdForUser(req.user.id, id);
    if (!tx) return res.status(404).json({ error: 'Transaction introuvable.' });
    if (tx.status !== 'en_attente') return res.json({ transaction: tx });
    if (!tx.provider_transaction_id) {
        return res.status(400).json({ error: 'Aucune transaction SebPay associée.' });
    }

    try {
        const remote = await sebpay.getCollection(tx.provider_transaction_id);
        const updated = await applyRemoteStatus(tx, remote.status);
        res.json({ transaction: updated });
    } catch (err) {
        res.status(502).json({ error: err.message || 'Impossible de resynchroniser la transaction.' });
    }
}

// Applique le statut distant (approved/rejected/pending) à une transaction locale.
// Idempotent : si la transaction n'est plus en_attente, ne fait rien (évite un
// double crédit si le webhook et un resync manuel arrivent en même temps).
async function applyRemoteStatus(tx, remoteStatus) {
    if (tx.status !== 'en_attente') return tx;

    if (remoteStatus === 'approved') {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await walletModel.incrementBalance(client, tx.user_id, tx.crypto, parseFloat(tx.crypto_amount));
            const updated = await transactionModel.updateStatus(client, tx.id, 'termine');
            await client.query('COMMIT');
            return updated;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    if (remoteStatus === 'rejected') {
        return transactionModel.updateStatus(null, tx.id, 'echoue');
    }

    return tx; // toujours pending côté SebPay, rien à faire
}

// Endpoint public (pas de JWT) — appelé par les serveurs SebPay, authentifié
// uniquement par la signature HMAC. Doit répondre vite (< 5s selon la doc).
async function webhook(req, res) {
    const signature = req.headers['x-sebpay-signature'];
    const valid = sebpay.verifyWebhookSignature(req.rawBody, signature);
    if (!valid) {
        console.warn('Webhook SebPay reçu avec une signature invalide ou absente.');
        return res.status(401).json({ error: 'Signature invalide.' });
    }

    const { transaction_id, external_reference, status } = req.body;

    try {
        // external_reference est toujours notre id interne (voir initiateCollection).
        let tx = await transactionModel.findByIdRaw(external_reference);
        if (!tx && transaction_id) {
            tx = await transactionModel.findByProviderTransactionId(transaction_id);
        }
        if (!tx) {
            console.warn('Webhook SebPay : transaction introuvable.', { transaction_id, external_reference });
            // On répond 200 pour éviter que SebPay ne retente indéfiniment un
            // webhook qui ne correspondra jamais à une transaction chez nous.
            return res.status(200).json({ received: true });
        }

        if (!tx.provider_transaction_id && transaction_id) {
            await transactionModel.updatePaymentProviderInfo(tx.id, {
                providerTransactionId: transaction_id,
                providerLink: tx.provider_link
            });
        }

        await applyRemoteStatus(tx, status);
        res.status(200).json({ received: true });
    } catch (err) {
        console.error('Erreur lors du traitement du webhook SebPay :', err);
        // 500 volontaire : SebPay retentera l'envoi du webhook plus tard.
        res.status(500).json({ error: 'Erreur interne.' });
    }
}

module.exports = { getOperators, initiateCollection, getCollectionStatus, syncCollection, webhook };
