// Prix D'ACHAT : FCFA à payer pour obtenir 1 unité de crypto.
const CRYPTO_BUY_RATES = {
    USDT: 592,
    BTC: 35000000,
    ETH: 2200000,
    BNB: 350000
};

// Prix DE VENTE : FCFA reçus pour 1 unité de crypto vendue — toujours
// inférieur au prix d'achat (spread de la plateforme).
// USDT confirmé à 566. Les autres cryptos appliquent le même ratio de
// spread (566/592) — VALEUR PLACEHOLDER, à ajuster si tu veux un spread
// différent par crypto.
const SPREAD_RATIO = 566 / 592;
const CRYPTO_SELL_RATES = {
    USDT: 566,
    BTC: Math.round(CRYPTO_BUY_RATES.BTC * SPREAD_RATIO),
    ETH: Math.round(CRYPTO_BUY_RATES.ETH * SPREAD_RATIO),
    BNB: Math.round(CRYPTO_BUY_RATES.BNB * SPREAD_RATIO)
};

// Conservé pour compatibilité (valorisation générale du wallet) — utilise
// le prix de VENTE par convention (valeur de liquidation, plus prudente
// que le prix d'achat).
const CRYPTO_RATES = CRYPTO_SELL_RATES;

const NETWORKS_BY_CRYPTO = {
    USDT: ['TRC20 (Tron)', 'ERC20 (Ethereum)', 'BEP20 (BNB Smart Chain)'],
    BTC: ['Bitcoin (BTC)'],
    ETH: ['ERC20 (Ethereum)'],
    BNB: ['BEP20 (BNB Smart Chain)']
};

function isValidCrypto(c) {
    return Object.prototype.hasOwnProperty.call(CRYPTO_BUY_RATES, c);
}

// Frais de retrait FCFA → Mobile Money — VALEURS PLACEHOLDER À VALIDER.
const FCFA_WITHDRAWAL_FEE_PERCENT = 1.5;
const FCFA_WITHDRAWAL_MIN_FEE = 100;
const MIN_FCFA_WITHDRAWAL = 500;

function computeFcfaWithdrawalFee(amount) {
    const fee = Math.round(amount * FCFA_WITHDRAWAL_FEE_PERCENT / 100);
    return Math.max(fee, FCFA_WITHDRAWAL_MIN_FEE);
}

module.exports = {
    CRYPTO_BUY_RATES, CRYPTO_SELL_RATES, CRYPTO_RATES,
    NETWORKS_BY_CRYPTO, isValidCrypto,
    FCFA_WITHDRAWAL_FEE_PERCENT, FCFA_WITHDRAWAL_MIN_FEE, MIN_FCFA_WITHDRAWAL,
    computeFcfaWithdrawalFee
};
