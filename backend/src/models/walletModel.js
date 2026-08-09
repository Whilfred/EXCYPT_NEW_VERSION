const { query } = require('../config/database');

const CURRENCIES = ['USDT', 'BTC', 'ETH', 'BNB'];

async function ensureBalances(userId) {
    for (const currency of CURRENCIES) {
        await query(
            `INSERT INTO balances (user_id, currency, amount) VALUES ($1, $2, 0)
             ON CONFLICT (user_id, currency) DO NOTHING`,
            [userId, currency]
        );
    }
}

async function getBalances(userId) {
    await ensureBalances(userId);
    const result = await query('SELECT currency, amount FROM balances WHERE user_id = $1', [userId]);
    const balances = { USDT: 0, BTC: 0, ETH: 0, BNB: 0 };
    result.rows.forEach(row => { balances[row.currency] = parseFloat(row.amount); });
    return balances;
}

// À utiliser UNIQUEMENT à l'intérieur d'une transaction SQL (client = résultat de pool.connect())
async function getBalanceForUpdate(client, userId, currency) {
    const result = await client.query(
        'SELECT amount FROM balances WHERE user_id = $1 AND currency = $2 FOR UPDATE',
        [userId, currency]
    );
    return result.rows[0] ? parseFloat(result.rows[0].amount) : 0;
}

async function incrementBalance(client, userId, currency, amount) {
    await client.query(
        `INSERT INTO balances (user_id, currency, amount) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, currency) DO UPDATE SET amount = balances.amount + $3, updated_at = now()`,
        [userId, currency, amount]
    );
}

async function decrementBalance(client, userId, currency, amount) {
    const current = await getBalanceForUpdate(client, userId, currency);
    if (current < amount) {
        throw new Error(`Solde ${currency} insuffisant.`);
    }
    await client.query(
        'UPDATE balances SET amount = amount - $3, updated_at = now() WHERE user_id = $1 AND currency = $2',
        [userId, currency, amount]
    );
}

module.exports = { CURRENCIES, ensureBalances, getBalances, getBalanceForUpdate, incrementBalance, decrementBalance };
