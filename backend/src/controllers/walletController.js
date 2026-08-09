const walletModel = require('../models/walletModel');
const { CRYPTO_RATES } = require('../utils/rates');

async function getBalances(req, res) {
    const balances = await walletModel.getBalances(req.user.id);
    const totalFCFA = Object.entries(balances).reduce((sum, [c, amt]) => sum + amt * CRYPTO_RATES[c], 0);
    res.json({ balances, rates: CRYPTO_RATES, totalFCFA });
}

module.exports = { getBalances };
