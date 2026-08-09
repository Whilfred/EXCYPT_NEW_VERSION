const bcrypt = require('bcrypt');
const userModel = require('../models/userModel');
const { query } = require('../config/database');

async function getSettings(req, res) {
    const user = await userModel.findById(req.user.id);
    res.json({
        settings: {
            theme: user.theme,
            language: user.language,
            notifications: { email: user.notif_email, sms: user.notif_sms, push: user.notif_push },
            twoFactor: user.two_factor_enabled
        }
    });
}

async function updateSettings(req, res) {
    const { theme, language, notifications = {}, twoFactor } = req.body;
    const updated = await userModel.updateSettings(req.user.id, {
        theme, language,
        notifEmail: notifications.email,
        notifSms: notifications.sms,
        notifPush: notifications.push,
        twoFactorEnabled: twoFactor
    });
    res.json({ settings: updated });
}

async function changePassword(req, res) {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: 'Mot de passe invalide (8 caractères minimum).' });
    }
    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Mot de passe actuel incorrect.' });

    await userModel.updatePassword(req.user.id, newPassword);
    res.json({ success: true });
}

module.exports = { getSettings, updateSettings, changePassword };
