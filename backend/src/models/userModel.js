const bcrypt = require('bcrypt');
const { query } = require('../config/database');

const SALT_ROUNDS = 10;

async function createUser({ firstName, lastName, email, phone, country, password }) {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await query(
        `INSERT INTO users (first_name, last_name, email, phone, country, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, first_name, last_name, email, phone, country, kyc_status, theme,
                   language, notif_email, notif_sms, notif_push, two_factor_enabled, created_at`,
        [firstName, lastName || '', email.toLowerCase(), phone || null, country || 'Burkina Faso', passwordHash]
    );
    return result.rows[0];
}

async function findByEmail(email) {
    const result = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    return result.rows[0] || null;
}

async function findById(id) {
    const result = await query(
        `SELECT id, first_name, last_name, email, phone, country, kyc_status, theme, language,
                notif_email, notif_sms, notif_push, two_factor_enabled, created_at
         FROM users WHERE id = $1`,
        [id]
    );
    return result.rows[0] || null;
}

async function verifyPassword(user, password) {
    return bcrypt.compare(password, user.password_hash);
}

async function updateProfile(id, { firstName, lastName, email, phone, country }) {
    const result = await query(
        `UPDATE users SET
            first_name = COALESCE($2, first_name),
            last_name  = COALESCE($3, last_name),
            email      = COALESCE($4, email),
            phone      = COALESCE($5, phone),
            country    = COALESCE($6, country),
            updated_at = now()
         WHERE id = $1
         RETURNING id, first_name, last_name, email, phone, country, kyc_status`,
        [id, firstName, lastName, email ? email.toLowerCase() : null, phone, country]
    );
    return result.rows[0];
}

async function setKycStatus(id, status) {
    const result = await query(
        `UPDATE users SET kyc_status = $2, updated_at = now() WHERE id = $1
         RETURNING id, kyc_status`,
        [id, status]
    );
    return result.rows[0];
}

async function updateSettings(id, { theme, language, notifEmail, notifSms, notifPush, twoFactorEnabled }) {
    const result = await query(
        `UPDATE users SET
            theme = COALESCE($2, theme),
            language = COALESCE($3, language),
            notif_email = COALESCE($4, notif_email),
            notif_sms = COALESCE($5, notif_sms),
            notif_push = COALESCE($6, notif_push),
            two_factor_enabled = COALESCE($7, two_factor_enabled),
            updated_at = now()
         WHERE id = $1
         RETURNING id, theme, language, notif_email, notif_sms, notif_push, two_factor_enabled`,
        [id, theme, language, notifEmail, notifSms, notifPush, twoFactorEnabled]
    );
    return result.rows[0];
}

async function updatePassword(id, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await query('UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1', [id, passwordHash]);
}

module.exports = {
    createUser, findByEmail, findById, verifyPassword,
    updateProfile, setKycStatus, updateSettings, updatePassword
};
