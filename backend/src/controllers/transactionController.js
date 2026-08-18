const { pool } = require('../config/database');
const walletModel = require('../models/walletModel');
const transactionModel = require('../models/transactionModel');
const {
    CRYPTO_BUY_RATES, CRYPTO_SELL_RATES, NETWORKS_BY_CRYPTO, isValidCrypto,
    MIN_FCFA_WITHDRAWAL, computeFcfaWithdrawalFee
} = require('../utils/rates');

console.log('🟢 [transactionController] Chargement du contrôleur');

async function list(req, res) {
    try {
        const { type } = req.query;
        const transactions = await transactionModel.listTransactions(req.user.id, type);
        res.json({ transactions });
    } catch (error) {
        console.error('🔴 [list] Erreur:', error.message);
        res.status(500).json({ error: 'Erreur lors de la récupération des transactions' });
    }
}

// ================================================================
// TRADE : Achat et Vente
// ================================================================

async function trade(req, res) {
    console.log('📥 [trade] ========================================');
    console.log('📥 [trade] Requête reçue - Body complet:', JSON.stringify(req.body, null, 2));
    console.log('📥 [trade] Headers:', req.headers);
    console.log('📥 [trade] ========================================');

    const { type, crypto, network, phone, country, address, cryptoNetwork } = req.body;
    
    // Récupérer les montants de plusieurs façons possibles
    let cryptoAmount = parseFloat(req.body.cryptoAmount) || 0;
    let fcfaAmount = parseFloat(req.body.fcfaAmount) || 0;
    
    // Si fcfaAmount n'est pas trouvé, essayer d'autres noms de champs
    if (!fcfaAmount || isNaN(fcfaAmount) || fcfaAmount <= 0) {
        fcfaAmount = parseFloat(req.body.montant) || 0;
    }
    if (!fcfaAmount || isNaN(fcfaAmount) || fcfaAmount <= 0) {
        fcfaAmount = parseFloat(req.body.amount) || 0;
    }
    if (!fcfaAmount || isNaN(fcfaAmount) || fcfaAmount <= 0) {
        fcfaAmount = parseFloat(req.body.montantSaisi) || 0;
    }
    
    console.log(`📊 [trade] Type: ${type}`);
    console.log(`📊 [trade] Crypto: ${crypto}`);
    console.log(`📊 [trade] cryptoAmount: ${cryptoAmount} (brut: ${req.body.cryptoAmount})`);
    console.log(`📊 [trade] fcfaAmount: ${fcfaAmount} (brut: ${req.body.fcfaAmount})`);
    console.log(`📊 [trade] phone: ${phone}`);
    console.log(`📊 [trade] network: ${network}`);
    console.log(`📊 [trade] country: ${country}`);
    console.log(`📊 [trade] address: ${address}`);
    console.log(`📊 [trade] cryptoNetwork: ${cryptoNetwork}`);

    // ================================================================
    // VALIDATIONS COMMUNES
    // ================================================================

    if (!['achat', 'vente'].includes(type)) {
        console.error('🔴 [trade] Type invalide:', type);
        return res.status(400).json({ error: 'Type invalide.' });
    }
    if (!isValidCrypto(crypto)) {
        console.error('🔴 [trade] Crypto invalide:', crypto);
        return res.status(400).json({ error: 'Crypto invalide.' });
    }
    if (!phone || !network || !country) {
        console.error('🔴 [trade] Données manquantes:', { phone, network, country });
        return res.status(400).json({ error: 'Réseau, pays et téléphone requis.' });
    }

    // ================================================================
    // TRAITEMENT ACHAT
    // ================================================================

    if (type === 'achat') {
        console.log('🟢 [achat] Début du traitement');
        console.log(`🟢 [achat] fcfaAmount reçu: ${fcfaAmount}, type: ${typeof fcfaAmount}`);
        
        // Vérification stricte du montant
        if (!fcfaAmount || isNaN(fcfaAmount) || fcfaAmount <= 0) {
            console.error('🔴 [achat] fcfaAmount invalide:', fcfaAmount);
            console.error('🔴 [achat] Body complet:', req.body);
            return res.status(400).json({ 
                error: 'Montant FCFA invalide. Veuillez saisir un montant valide (ex: 5000).',
                debug: {
                    received: req.body,
                    fcfaAmount: req.body.fcfaAmount,
                    parsed: fcfaAmount
                }
            });
        }

        // Vérifications pour l'achat
        if (!address) {
            console.error('🔴 [achat] Adresse manquante');
            return res.status(400).json({ error: 'Adresse de réception requise.' });
        }
        if (!cryptoNetwork || !NETWORKS_BY_CRYPTO[crypto] || !NETWORKS_BY_CRYPTO[crypto].includes(cryptoNetwork)) {
            console.error('🔴 [achat] Réseau blockchain invalide:', cryptoNetwork);
            return res.status(400).json({ error: 'Réseau blockchain invalide pour cette crypto.' });
        }

        const buyRate = CRYPTO_BUY_RATES[crypto];
        console.log(`🟢 [achat] Taux d\'achat: ${buyRate}`);
        
        // 1. Frais de service (4% du montant saisi)
        const serviceFee = fcfaAmount * 0.04;
        const totalAPayer = fcfaAmount + serviceFee;

        // 2. Conversion en USDT
        const usdtBrut = totalAPayer / buyRate;

        // 3. Frais de réseau (1.5 USDT)
        const networkFeeCrypto = 1.5;
        const cryptoAmountNet = usdtBrut - networkFeeCrypto;

        // 4. Vérifier que le montant est positif
        if (cryptoAmountNet <= 0) {
            const minAmount = Math.ceil((networkFeeCrypto * buyRate) / 0.96 + 500);
            console.error('🔴 [achat] Montant insuffisant, minimum:', minAmount);
            return res.status(400).json({ 
                error: `Montant insuffisant. Minimum recommandé : ${minAmount.toLocaleString('fr-FR')} FCFA.`
            });
        }

        console.log(`📊 [achat] ${fcfaAmount} FCFA → ${cryptoAmountNet.toFixed(6)} ${crypto}`);
        console.log(`📊 [achat] Détail: ServiceFee=${serviceFee}, TotalAPayer=${totalAPayer}, NetworkFee=${networkFeeCrypto}`);

        // Stocker le cryptoAmount final
        cryptoAmount = cryptoAmountNet;

        // Calculer le montant des frais en FCFA pour la base de données
        const feeAmountFcfa = Math.round(serviceFee);

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const tx = await transactionModel.createTransaction(client, req.user.id, {
                type: 'achat',
                status: 'en_attente',
                crypto,
                cryptoAmount: cryptoAmountNet,
                fcfaAmount: totalAPayer,  // Total à payer
                feeAmount: feeAmountFcfa,
                network,
                phone,
                country,
                address,
                cryptoNetwork
            });

            await client.query('COMMIT');
            
            console.log('✅ [achat] Transaction créée avec succès, ID:', tx.id);
            
            res.status(201).json({
                success: true,
                transaction: tx,
                quote: {
                    montantSaisi: fcfaAmount,
                    serviceFee: Math.round(serviceFee),
                    totalAPayer: Math.round(totalAPayer),
                    cryptoAmount: cryptoAmountNet,
                    crypto,
                    buyRate,
                    networkFeeCrypto
                }
            });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('🔴 [achat] ERREUR SQL:', err.message);
            console.error('🔴 [achat] Stack:', err.stack);
            res.status(400).json({ 
                success: false, 
                error: err.message || "Erreur lors de l'achat." 
            });
        } finally {
            client.release();
        }
    }

    // ================================================================
    // TRAITEMENT VENTE
    // ================================================================

    if (type === 'vente') {
        console.log('🟢 [vente] Début du traitement');
        console.log(`🟢 [vente] cryptoAmount reçu: ${cryptoAmount}, type: ${typeof cryptoAmount}`);
        
        // Le client envoie cryptoAmount (la quantité de crypto qu'il vend)
        if (!cryptoAmount || cryptoAmount <= 0 || isNaN(cryptoAmount)) {
            console.error('🔴 [vente] cryptoAmount invalide:', cryptoAmount);
            return res.status(400).json({ error: 'Montant crypto invalide.' });
        }

        const sellRate = CRYPTO_SELL_RATES[crypto];
        console.log(`🟢 [vente] Taux de vente: ${sellRate}`);

        // 1. Valeur brute en FCFA
        const grossFcfa = cryptoAmount * sellRate;

        // 2. Frais de service (2%)
        const serviceFee = grossFcfa * 0.02;
        const netFcfa = grossFcfa - serviceFee;

        console.log(`📊 [vente] ${cryptoAmount} ${crypto} → ${netFcfa} FCFA`);
        console.log(`📊 [vente] Détail: GrossFcfa=${grossFcfa}, ServiceFee=${serviceFee}, NetFcfa=${netFcfa}`);

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Débiter le compte crypto
            await walletModel.decrementBalance(client, req.user.id, crypto, cryptoAmount);

            const tx = await transactionModel.createTransaction(client, req.user.id, {
                type: 'vente',
                status: 'en_attente',
                crypto,
                cryptoAmount,
                fcfaAmount: Math.round(netFcfa),
                feeAmount: Math.round(serviceFee),
                network,
                phone,
                country
            });

            await client.query('COMMIT');
            
            console.log('✅ [vente] Transaction créée avec succès, ID:', tx.id);
            
            res.status(201).json({
                success: true,
                transaction: tx,
                quote: {
                    cryptoAmount,
                    grossFcfa: Math.round(grossFcfa),
                    serviceFee: Math.round(serviceFee),
                    netFcfa: Math.round(netFcfa),
                    crypto,
                    sellRate
                }
            });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('🔴 [vente] ERREUR SQL:', err.message);
            console.error('🔴 [vente] Stack:', err.stack);
            res.status(400).json({ 
                success: false, 
                error: err.message || "Erreur lors de la vente." 
            });
        } finally {
            client.release();
        }
    }
}

// ================================================================
// CONVERSION
// ================================================================

async function convert(req, res) {
    console.log('📥 [convert] Requête reçue:', req.body);
    
    const { fromCurrency, toCurrency } = req.body;
    const fromAmount = parseFloat(req.body.fromAmount);

    const isFromCrypto = fromCurrency !== 'FCFA';
    const isToCrypto = toCurrency !== 'FCFA';

    if (isFromCrypto && !isValidCrypto(fromCurrency)) {
        return res.status(400).json({ error: 'Devise source invalide.' });
    }
    if (isToCrypto && !isValidCrypto(toCurrency)) {
        return res.status(400).json({ error: 'Devise cible invalide.' });
    }
    if (fromCurrency === toCurrency) {
        return res.status(400).json({ error: 'Choisissez deux devises différentes.' });
    }
    if (!fromAmount || fromAmount <= 0 || isNaN(fromAmount)) {
        return res.status(400).json({ error: 'Montant invalide.' });
    }

    // On "vend" fromCurrency (taux de vente si crypto) puis on "achète"
    // toCurrency (taux d'achat si crypto)
    const fcfaValue = isFromCrypto ? fromAmount * CRYPTO_SELL_RATES[fromCurrency] : fromAmount;
    const toAmount = isToCrypto ? fcfaValue / CRYPTO_BUY_RATES[toCurrency] : fcfaValue;

    console.log(`📊 [convert] ${fromAmount} ${fromCurrency} → ${toAmount} ${toCurrency}`);

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await walletModel.decrementBalance(client, req.user.id, fromCurrency, fromAmount);
        await walletModel.incrementBalance(client, req.user.id, toCurrency, toAmount);

        const tx = await transactionModel.createTransaction(client, req.user.id, {
            type: 'conversion',
            status: 'termine',
            fromCurrency,
            fromAmount,
            toCurrency,
            toAmount
        });

        await client.query('COMMIT');
        res.status(201).json({ transaction: tx });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('🔴 [convert] ERREUR:', err.message);
        res.status(400).json({ error: err.message || 'Erreur lors de la conversion.' });
    } finally {
        client.release();
    }
}

// ================================================================
// DÉPÔT
// ================================================================

async function deposit(req, res) {
    console.log('📥 [deposit] Requête reçue:', req.body);
    
    const { crypto, network, txId } = req.body;
    const amount = req.body.amount ? parseFloat(req.body.amount) : null;

    if (!isValidCrypto(crypto)) {
        return res.status(400).json({ error: 'Crypto invalide.' });
    }
    if (!NETWORKS_BY_CRYPTO[crypto].includes(network)) {
        return res.status(400).json({ error: 'Réseau invalide pour cette crypto.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const tx = await transactionModel.createTransaction(client, req.user.id, {
            type: 'depot',
            status: 'en_attente',
            crypto,
            cryptoAmount: amount,
            network,
            txId
        });
        await client.query('COMMIT');
        res.status(201).json({ transaction: tx });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('🔴 [deposit] ERREUR:', err.message);
        res.status(400).json({ error: err.message || "Erreur lors de l'enregistrement du dépôt." });
    } finally {
        client.release();
    }
}

// ================================================================
// RETRAIT CRYPTO
// ================================================================

async function withdraw(req, res) {
    console.log('📥 [withdraw] Requête reçue:', req.body);
    
    const { crypto, network, address } = req.body;
    const amount = parseFloat(req.body.amount);

    if (!isValidCrypto(crypto)) {
        return res.status(400).json({ error: 'Crypto invalide.' });
    }
    if (!NETWORKS_BY_CRYPTO[crypto].includes(network)) {
        return res.status(400).json({ error: 'Réseau invalide pour cette crypto.' });
    }
    if (!address) {
        return res.status(400).json({ error: 'Adresse de destination requise.' });
    }
    if (!amount || amount <= 0 || isNaN(amount)) {
        return res.status(400).json({ error: 'Montant invalide.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        await walletModel.decrementBalance(client, req.user.id, crypto, amount);
        const tx = await transactionModel.createTransaction(client, req.user.id, {
            type: 'retrait',
            status: 'en_attente',
            crypto,
            cryptoAmount: amount,
            network,
            address
        });
        await client.query('COMMIT');
        res.status(201).json({ transaction: tx });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('🔴 [withdraw] ERREUR:', err.message);
        res.status(400).json({ error: err.message || 'Erreur lors du retrait.' });
    } finally {
        client.release();
    }
}

// ================================================================
// RETRAIT FCFA (Mobile Money)
// ================================================================

async function withdrawFcfa(req, res) {
    console.log('📥 [withdrawFcfa] Requête reçue:', req.body);
    
    const { network, phone, country } = req.body;
    const amount = parseFloat(req.body.amount);

    if (!amount || amount <= 0 || isNaN(amount)) {
        return res.status(400).json({ error: 'Montant invalide.' });
    }
    if (amount < MIN_FCFA_WITHDRAWAL) {
        return res.status(400).json({ error: `Le montant minimum de retrait est de ${MIN_FCFA_WITHDRAWAL} FCFA.` });
    }
    if (!phone || !network || !country) {
        return res.status(400).json({ error: 'Réseau, pays et téléphone requis.' });
    }

    const feeAmount = computeFcfaWithdrawalFee(amount);
    const totalDebited = amount + feeAmount;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        await walletModel.decrementBalance(client, req.user.id, 'FCFA', totalDebited);

        const tx = await transactionModel.createTransaction(client, req.user.id, {
            type: 'retrait_fcfa',
            status: 'en_attente',
            fcfaAmount: amount,
            feeAmount,
            network,
            phone,
            country
        });

        await client.query('COMMIT');
        res.status(201).json({ transaction: tx, feeAmount, totalDebited });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('🔴 [withdrawFcfa] ERREUR:', err.message);
        res.status(400).json({ error: err.message || 'Erreur lors du retrait FCFA.' });
    } finally {
        client.release();
    }
}

// ================================================================
// CONFIRMER UNE TRANSACTION (Admin)
// ================================================================

async function confirm(req, res) {
    console.log('📥 [confirm] Requête reçue, ID:', req.params.id);
    
    const { id } = req.params;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const tx = await transactionModel.findByIdForUpdate(client, req.user.id, id);
        if (!tx) throw new Error('Transaction introuvable.');

        if (tx.status !== 'en_attente') {
            throw new Error('Cette transaction a déjà été traitée.');
        }

        if ((tx.type === 'depot' || tx.type === 'achat') && tx.crypto_amount) {
            await walletModel.incrementBalance(client, req.user.id, tx.crypto, parseFloat(tx.crypto_amount));
        }

        const updated = await transactionModel.updateStatus(client, id, 'termine');
        await client.query('COMMIT');
        res.json({ transaction: updated });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('🔴 [confirm] ERREUR:', err.message);
        res.status(400).json({ error: err.message || 'Erreur lors de la confirmation.' });
    } finally {
        client.release();
    }
}

// ================================================================
// ANNULER UNE TRANSACTION (Admin)
// ================================================================

async function cancel(req, res) {
    console.log('📥 [cancel] Requête reçue, ID:', req.params.id);
    
    const { id } = req.params;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const tx = await transactionModel.findByIdForUpdate(client, req.user.id, id);
        if (!tx) throw new Error('Transaction introuvable.');

        if (tx.status !== 'en_attente') {
            throw new Error('Cette transaction a déjà été traitée.');
        }

        if ((tx.type === 'retrait' || tx.type === 'vente') && tx.crypto_amount) {
            await walletModel.incrementBalance(client, req.user.id, tx.crypto, parseFloat(tx.crypto_amount));
        }
        if (tx.type === 'retrait_fcfa') {
            const total = parseFloat(tx.fcfa_amount) + parseFloat(tx.fee_amount || 0);
            await walletModel.incrementBalance(client, req.user.id, 'FCFA', total);
        }

        const updated = await transactionModel.updateStatus(client, id, 'echoue');
        await client.query('COMMIT');
        res.json({ transaction: updated });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('🔴 [cancel] ERREUR:', err.message);
        res.status(400).json({ error: err.message || "Erreur lors de l'annulation." });
    } finally {
        client.release();
    }
}

console.log('✅ [transactionController] Toutes les fonctions exportées');

module.exports = { list, trade, convert, deposit, withdraw, withdrawFcfa, confirm, cancel };
