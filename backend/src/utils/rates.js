// Taux indicatifs FCFA. À terme, brancher un flux de cours temps réel
// (CoinGecko, Binance API, etc.) au lieu de valeurs fixes.
const CRYPTO_RATES = {
    USDT: 592,
    BTC: 35000000,
    ETH: 2200000,
    BNB: 350000
};

const NETWORKS_BY_CRYPTO = {
    USDT: ['TRC20 (Tron)', 'ERC20 (Ethereum)', 'BEP20 (BNB Smart Chain)'],
    BTC: ['Bitcoin (BTC)'],
    ETH: ['ERC20 (Ethereum)'],
    BNB: ['BEP20 (BNB Smart Chain)']
};

function isValidCrypto(c) {
    return Object.prototype.hasOwnProperty.call(CRYPTO_RATES, c);
}

module.exports = { CRYPTO_RATES, NETWORKS_BY_CRYPTO, isValidCrypto };
