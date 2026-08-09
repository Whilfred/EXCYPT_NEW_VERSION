const { query } = require('../config/database');

async function createTransaction(client, userId, data) {
    const result = await client.query(
        `INSERT INTO transactions
            (user_id, type, status, crypto, crypto_amount, fcfa_amount, network, phone, country,
             from_currency, from_amount, to_currency, to_amount, address, tx_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING *`,
        [
            userId, data.type, data.status || 'en_attente', data.crypto || null, data.cryptoAmount || null,
            data.fcfaAmount || null, data.network || null, data.phone || null, data.country || null,
            data.fromCurrency || null, data.fromAmount || null, data.toCurrency || null, data.toAmount || null,
            data.address || null, data.txId || null
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

async function updateStatus(client, id, status) {
    const result = await client.query(
        'UPDATE transactions SET status = $2, updated_at = now() WHERE id = $1 RETURNING *',
        [id, status]
    );
    return result.rows[0];
}

module.exports = { createTransaction, listTransactions, findByIdForUpdate, updateStatus };
