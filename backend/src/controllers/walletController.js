const walletModel = require('../models/walletModel');
const { CRYPTO_RATES } = require('../utils/rates');

async function getBalances(req, res) {
    const balances = await walletModel.getBalances(req.user.id);
    const { FCFA, ...cryptoBalances } = balances;
    // totalFCFA = valeur des cryptos détenues + FCFA réellement en solde
    // (avant, seule la valeur équivalente des cryptos était comptée : le
    // FCFA n'existait pas comme solde réel).
    const totalFCFA = Object.entries(cryptoBalances).reduce((sum, [c, amt]) => sum + amt * CRYPTO_RATES[c], 0) + (FCFA || 0);
    res.json({ balances, rates: CRYPTO_RATES, totalFCFA });
}

module.exports = { getBalances };
