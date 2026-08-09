const { verifyToken } = require('../utils/jwt');

function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentification requise.' });
    }
    const token = header.split(' ')[1];
    try {
        const payload = verifyToken(token);
        req.user = { id: payload.userId };
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token invalide ou expiré.' });
    }
}

module.exports = { authenticate };
