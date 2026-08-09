const userModel = require('../models/userModel');

async function getProfile(req, res) {
    const user = await userModel.findById(req.user.id);
    res.json({ profile: user });
}

async function updateProfile(req, res) {
    try {
        const { firstName, lastName, email, phone, country } = req.body;
        const updated = await userModel.updateProfile(req.user.id, { firstName, lastName, email, phone, country });
        res.json({ profile: updated });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Cet e-mail est déjà utilisé.' });
        }
        console.error(err);
        res.status(500).json({ error: 'Erreur lors de la mise à jour du profil.' });
    }
}

async function startKyc(req, res) {
    // TODO BACKEND : déclencher ici l'appel au prestataire KYC externe (upload pièce d'identité, selfie, etc.)
    const updated = await userModel.setKycStatus(req.user.id, 'en_attente');
    res.json({ profile: updated });
}

module.exports = { getProfile, updateProfile, startKyc };
