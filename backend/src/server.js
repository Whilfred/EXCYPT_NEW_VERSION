require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https'); // Ajout pour récupérer l'IP

const authRoutes = require('./routes/authRoutes');
const walletRoutes = require('./routes/walletRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const profileRoutes = require('./routes/profileRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
// const sebpayRoutes = require('./routes/sebpayRoutes');

const app = express();

app.use(cors());

// FIX SEBPAY : le webhook doit vérifier une signature HMAC calculée sur le
// corps brut de la requête. express.json() ne conserve pas ce corps brut par
// défaut ; l'option `verify` ci-dessous le capture dans req.rawBody pour
// toutes les routes, sans rien changer au comportement du parsing JSON.
app.use(express.json({
    verify: (req, res, buf) => { req.rawBody = buf; }
}));

// Frontend
app.use('/frontend', express.static(
    path.join(__dirname, '../../frontend')
));

// Health
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// API
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/settings', settingsRoutes);
// app.use('/api/payments/sebpay', sebpayRoutes);

// 404
app.use((req, res) => {
    res.status(404).json({ error: 'Route introuvable.' });
});

// Erreurs
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
});

const PORT = process.env.PORT || 4000 || 8080;

app.listen(PORT, () => {
    console.log(`ExCrypt API démarrée sur le port ${PORT}`);

    // Récupération automatique de l'IP publique sortante (utile pour la Whitelist SebPay)
    https.get('https://api.ipify.org?format=json', (resp) => {
        let data = '';
        resp.on('data', (chunk) => { data += chunk; });
        resp.on('end', () => {
            try {
                const parsed = JSON.parse(data);
                console.log(`📍 IP PUBLIQUE DE RENDER: ${parsed.ip}`);
            } catch (e) {
                console.log("Impossible de parser l'adresse IP.");
            }
        });
    }).on("error", (err) => {
        console.log("Erreur lors de la récupération de l'IP: " + err.message);
    });
});