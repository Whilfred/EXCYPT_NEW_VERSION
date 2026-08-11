const { pool, query } = require('../config/database');

function exec(client, text, params) {
    return client ? client.query(text, params) : query(text, params);
}

async function createTransaction(client, userId, data) {
    const result = await exec(client,
        `INSERT INTO transactions
            (user_id, type, status, crypto, crypto_amount, fcfa_amount, fee_amount, network, crypto_network,
             phone, country, from_currency, from_amount, to_currency, to_amount, address, tx_id,
             payment_method, operator_slug, provider_transaction_id, provider_link)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         RETURNING *`,
        [
            userId, data.type, data.status || 'en_attente', data.crypto || null, data.cryptoAmount || null,
            data.fcfaAmount || null, data.feeAmount || null, data.network || null, data.cryptoNetwork || null,
            data.phone || null, data.country || null,
            data.fromCurrency || null, data.fromAmount || null, data.toCurrency || null, data.toAmount || null,
            data.address || null, data.txId || null,
            data.paymentMethod || null, data.operatorSlug || null,
            data.providerTransactionId || null, data.providerLink || null
        ]
    );
    return result.rows[0];
}

async function listTransactions(userId, type) {
    if (type && type !== 'tous') {
        const result = await query(
            'SELECT * FROM transactions WHERE user_id = $1 AND type = $2 ORDER BY created_at DESC',
            [userId, type]
        );
        return result.rows;
    }
    const result = await query('SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    return result.rows;
}

async function findByIdForUpdate(client, userId, id) {
    const result = await client.query(
        'SELECT * FROM transactions WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [id, userId]
    );
    return result.rows[0] || null;
}

async function findByIdForUser(userId, id) {
    const result = await query('SELECT * FROM transactions WHERE id = $1 AND user_id = $2', [id, userId]);
    return result.rows[0] || null;
}

async function findByIdRaw(id) {
    if (!id || isNaN(parseInt(id, 10))) return null;
    const result = await query('SELECT * FROM transactions WHERE id = $1', [id]);
    return result.rows[0] || null;
}

async function findByProviderTransactionId(providerTransactionId) {
    if (!providerTransactionId) return null;
    const result = await query(
        'SELECT * FROM transactions WHERE provider_transaction_id = $1',
        [providerTransactionId]
    );
    return result.rows[0] || null;
}

async function updateStatus(client, id, status) {
    const result = await exec(client,
        'UPDATE transactions SET status = $2, updated_at = now() WHERE id = $1 RETURNING *',
        [id, status]
    );
    return result.rows[0];
}

async function updatePaymentProviderInfo(id, { providerTransactionId, providerLink }) {
    const result = await query(
        `UPDATE transactions SET
            provider_transaction_id = COALESCE($2, provider_transaction_id),
            provider_link = COALESCE($3, provider_link),
            updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [id, providerTransactionId || null, providerLink || null]
    );
    return result.rows[0];
}

module.exports = {
    createTransaction, listTransactions, findByIdForUpdate, findByIdForUser,
    findByIdRaw, findByProviderTransactionId, updateStatus, updatePaymentProviderInfo
};
