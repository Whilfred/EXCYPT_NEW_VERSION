const walletModel = require('../models/walletModel');
const { CRYPTO_BUY_RATES, CRYPTO_SELL_RATES } = require('../utils/rates');

async function getBalances(req, res) {
    const balances = await walletModel.getBalances(req.user.id);
    const { FCFA, ...cryptoBalances } = balances;
    // Valorisation "Cryptos" = valeur de liquidation (prix de vente).
    const cryptoValueFCFA = Object.entries(cryptoBalances).reduce((sum, [c, amt]) => sum + amt * CRYPTO_SELL_RATES[c], 0);
    res.json({
        balances,
        buyRates: CRYPTO_BUY_RATES,
        sellRates: CRYPTO_SELL_RATES,
        cryptoValueFCFA
    });
}

module.exports = { getBalances };
