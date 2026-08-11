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

// Frais de retrait FCFA → Mobile Money — VALEURS PLACEHOLDER À VALIDER.
// 1,5% du montant que le client veut recevoir, minimum 100 FCFA.
// Le total débité du solde FCFA = montant demandé + frais.
const FCFA_WITHDRAWAL_FEE_PERCENT = 1.5;
const FCFA_WITHDRAWAL_MIN_FEE = 100;
const MIN_FCFA_WITHDRAWAL = 500;

function computeFcfaWithdrawalFee(amount) {
    const fee = Math.round(amount * FCFA_WITHDRAWAL_FEE_PERCENT / 100);
    return Math.max(fee, FCFA_WITHDRAWAL_MIN_FEE);
}

module.exports = {
    CRYPTO_RATES, NETWORKS_BY_CRYPTO, isValidCrypto,
    FCFA_WITHDRAWAL_FEE_PERCENT, FCFA_WITHDRAWAL_MIN_FEE, MIN_FCFA_WITHDRAWAL,
    computeFcfaWithdrawalFee
};
