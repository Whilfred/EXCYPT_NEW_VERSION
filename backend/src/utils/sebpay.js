// backend/src/utils/sebpay.js
const https = require('https');
const crypto = require('crypto');

const BASE_URL = process.env.SEBPAY_BASE_URL || 'https://newapi.sebpay.bj/api/v1';
const PUBLIC_KEY = process.env.SEBPAY_PUBLIC_KEY;
const SECRET_KEY = process.env.SEBPAY_SECRET_KEY;

// Mode mock : à activer UNIQUEMENT en développement local, tant que l'IP
// n'est pas approuvée côté SebPay. Ne jamais activer en production —
// aucun vrai paiement n'est effectué dans ce mode.
const MOCK_MODE = process.env.SEBPAY_MOCK === 'true';

function request(method, path, { body, query } = {}) {
    return new Promise((resolve, reject) => {
        if (!PUBLIC_KEY || !SECRET_KEY) {
            return reject(new Error('Clés SebPay manquantes (SEBPAY_PUBLIC_KEY / SEBPAY_SECRET_KEY).'));
        }

        const url = new URL(BASE_URL + path);
        if (query) {
            Object.entries(query).forEach(([k, v]) => {
                if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
            });
        }

        const payload = body ? JSON.stringify(body) : null;
        const headers = {
            'X-Public-Key': PUBLIC_KEY,
            'X-Secret-Key': SECRET_KEY,
            'Content-Type': 'application/json'
        };
        if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

        const options = {
            method,
            hostname: url.hostname,
            path: url.pathname + url.search,
            headers
        };

        const req = https.request(options, (res) => {
            let raw = '';
            res.on('data', (chunk) => { raw += chunk; });
            res.on('end', () => {
                let parsed;
                try {
                    parsed = raw ? JSON.parse(raw) : {};
                } catch (err) {
                    return reject(new Error('Réponse SebPay invalide (non-JSON).'));
                }
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(parsed);
                } else {
                    const message = (parsed && (parsed.message || parsed.error)) || `Erreur SebPay (${res.statusCode})`;
                    const err = new Error(message);
                    err.statusCode = res.statusCode;
                    err.body = parsed;
                    reject(err);
                }
            });
        });

        req.on('error', (err) => reject(new Error('Impossible de contacter SebPay : ' + err.message)));
        if (payload) req.write(payload);
        req.end();
    });
}

// Jeu d'opérateurs factices, suffisant pour tester le formulaire d'achat
// (avec et sans OTP) sans dépendre du whitelisting IP.
const MOCK_OPERATORS = {
    BF: [
        { slug: 'moov-bf', name: 'Moov Africa BF', otp_required: false, ussd_code: '' },
        { slug: 'orange-bf', name: 'Orange Money BF', otp_required: true, ussd_code: '*144*4*6*montant#' }
    ],
    CI: [
        { slug: 'mtn-ci', name: 'MTN Money CI', otp_required: false, ussd_code: '' },
        { slug: 'orange-ci', name: 'Orange Money CI', otp_required: true, ussd_code: '#144*82#' }
    ]
};

async function initiateCollection(payload) {
    if (MOCK_MODE) {
        console.warn('⚠️  SEBPAY_MOCK actif — aucun vrai paiement initié.');
        return {
            transaction_id: 'MOCK-' + Date.now(),
            status: 'pending',
            external_reference: payload.external_reference,
            amount: payload.amount,
            currency: payload.currency,
            provider_link: null,
            message: '📱 [MOCK] Simule une demande envoyée au téléphone. Utilise le script de simulation de webhook pour la confirmer.'
        };
    }
    const res = await request('POST', '/collections', { body: payload });
    return res.data || res;
}

async function getCollection(idOrReference) {
    if (MOCK_MODE) {
        return { transaction_id: idOrReference, status: 'pending' };
    }
    const res = await request('GET', `/collections/${encodeURIComponent(idOrReference)}`);
    return res.data || res;
}

async function getOperators(country) {
    if (MOCK_MODE) {
        return MOCK_OPERATORS[country] || [];
    }
    const res = await request('GET', '/operators', { query: country ? { country } : undefined });
    return res.data || res;
}

function verifyWebhookSignature(rawBody, signatureHeader) {
    if (MOCK_MODE) return true; // en mock, on accepte les webhooks simulés sans signature réelle
    if (!signatureHeader || !rawBody) return false;
    const expected = crypto.createHmac('sha256', SECRET_KEY).update(rawBody).digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const receivedBuf = Buffer.from(String(signatureHeader), 'utf8');
    if (expectedBuf.length !== receivedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

module.exports = { initiateCollection, getCollection, getOperators, verifyWebhookSignature };