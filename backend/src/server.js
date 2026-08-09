require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const walletRoutes = require('./routes/walletRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const profileRoutes = require('./routes/profileRoutes');
const settingsRoutes = require('./routes/settingsRoutes');

const app = express();

app.use(cors());
app.use(express.json());

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

// 404
app.use((req, res) => {
    res.status(404).json({ error: 'Route introuvable.' });
});

// Erreurs
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
    console.log(`ExCrypt API démarrée sur le port ${PORT}`);
});