const userModel = require('../models/userModel');
const walletModel = require('../models/walletModel');
const { generateToken } = require('../utils/jwt');

function sanitizeUser(user) {
    const { password_hash, ...rest } = user;
    return rest;
}

async function register(req, res) {
    try {
        const { firstName, lastName, email, phone, country, password } = req.body;
        if (!firstName || !email || !password) {
            return res.status(400).json({ error: 'Prénom, e-mail et mot de passe sont requis.' });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
        }
        const existing = await userModel.findByEmail(email);
        if (existing) {
            return res.status(409).json({ error: 'Un compte existe déjà avec cet e-mail.' });
        }
        const user = await userModel.createUser({ firstName, lastName, email, phone, country, password });
        await walletModel.ensureBalances(user.id);
        const token = generateToken({ userId: user.id });
        res.status(201).json({ token, user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur lors de l'inscription." });
    }
}

async function login(req, res) {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'E-mail et mot de passe requis.' });
        }
        const user = await userModel.findByEmail(email);
        if (!user) return res.status(401).json({ error: 'Identifiants invalides.' });

        const valid = await userModel.verifyPassword(user, password);
        if (!valid) return res.status(401).json({ error: 'Identifiants invalides.' });

        const token = generateToken({ userId: user.id });
        res.json({ token, user: sanitizeUser(user) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur lors de la connexion.' });
    }
}

async function me(req, res) {
    try {
        const user = await userModel.findById(req.user.id);
        if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
        res.json({ user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
}

module.exports = { register, login, me };
