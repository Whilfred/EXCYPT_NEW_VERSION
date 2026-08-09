const https = require('https');
const crypto = require('crypto');

const BASE_URL = process.env.SEBPAY_BASE_URL || 'https://newapi.sebpay.bj/api/v1';
const PUBLIC_KEY = process.env.SEBPAY_PUBLIC_KEY;
const SECRET_KEY = process.env.SEBPAY_SECRET_KEY;

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

async function initiateCollection(payload) {
    const res = await request('POST', '/collections', { body: payload });
    return res.data || res;
}

async function getCollection(idOrReference) {
    const res = await request('GET', `/collections/${encodeURIComponent(idOrReference)}`);
    return res.data || res;
}

async function getOperators(country) {
    const res = await request('GET', '/operators', { query: country ? { country } : undefined });
    return res.data || res;
}

/**
 * ATTENTION — hypothèse à valider :
 * La documentation SebPay indique que X-SebPay-Signature est une signature
 * HMAC-SHA256 "calculée avec votre clé secrète", sans préciser l'encodage
 * (hex vs base64) ni si c'est le corps JSON brut ou une version normalisée
 * qui est signée. Cette implémentation suit la convention la plus courante :
 * HMAC-SHA256 en hexadécimal sur le corps brut de la requête.
 *
 * À FAIRE avant la mise en prod : déclencher un webhook de test réel (ou
 * demander un exemple au support SebPay) et comparer la signature reçue
 * avec celle calculée ici. Si ça ne correspond pas, tous les webhooks
 * seront rejetés silencieusement et aucun paiement ne sera jamais crédité
 * automatiquement.
 */
function verifyWebhookSignature(rawBody, signatureHeader) {
if (!signatureHeader || !rawBody) return false;
    const expected = crypto.createHmac('sha256', SECRET_KEY).update(rawBody).digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const receivedBuf = Buffer.from(String(signatureHeader), 'utf8');
    if (expectedBuf.length !== receivedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

module.exports = { initiateCollection, getCollection, getOperators, verifyWebhookSignature };