const { verifyToken } = require('../utils/jwt');
const { findUserById } = require('../models/userModel');

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token d authentification manquant'
      });
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Token invalide ou expire'
      });
    }
    
    const user = await findUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouve'
      });
    }
    
    req.userId = decoded.userId;
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({
      success: false,
      message: 'Erreur d authentification'
    });
  }
};

module.exports = { authenticate };
