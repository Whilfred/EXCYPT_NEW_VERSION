const { createUser, findUserByEmail, findUserById } = require('../models/userModel');
const { generateToken } = require('../utils/jwt');
const bcrypt = require('bcryptjs');

const register = async (req, res) => {
  try {
    console.log('📝 [REGISTER] Request body:', req.body);
    console.log('📝 [REGISTER] Headers:', req.headers);
    
    const { email, password, firstName, lastName, phoneNumber } = req.body;
    
    if (!email || !password || !firstName || !lastName || !phoneNumber) {
      console.log('❌ [REGISTER] Missing fields');
      return res.status(400).json({
        success: false,
        message: 'Tous les champs sont requis'
      });
    }
    
    console.log('🔍 [REGISTER] Checking if user exists...');
    const existing = await findUserByEmail(email);
    console.log('🔍 [REGISTER] Existing user:', existing);
    
    if (existing) {
      console.log('❌ [REGISTER] User already exists');
      return res.status(400).json({
        success: false,
        message: 'Cet email est déjà utilisé'
      });
    }
    
    console.log('👤 [REGISTER] Creating user...');
    const user = await createUser({ email, password, firstName, lastName, phoneNumber });
    console.log('✅ [REGISTER] User created:', user);
    
    console.log('🔑 [REGISTER] Generating token...');
    const token = generateToken(user.id);
    console.log('✅ [REGISTER] Token generated');
    
    res.status(201).json({
      success: true,
      message: 'Inscription réussie',
      data: { user, token }
    });
  } catch (error) {
    console.error('❌ [REGISTER] Error:', error);
    console.error('❌ [REGISTER] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de l\'inscription'
    });
  }
};

const login = async (req, res) => {
  try {
    console.log('🔑 [LOGIN] Request body:', req.body);
    console.log('🔑 [LOGIN] Headers:', req.headers);
    
    const { email, password } = req.body;
    
    if (!email || !password) {
      console.log('❌ [LOGIN] Missing email or password');
      return res.status(400).json({
        success: false,
        message: 'Email et mot de passe requis'
      });
    }
    
    console.log('🔍 [LOGIN] Finding user by email:', email);
    const user = await findUserByEmail(email);
    console.log('🔍 [LOGIN] User found:', user ? 'Yes' : 'No');
    
    if (!user) {
      console.log('❌ [LOGIN] User not found');
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }
    
    console.log('🔍 [LOGIN] Comparing password...');
    const isValid = await bcrypt.compare(password, user.password);
    console.log('🔍 [LOGIN] Password valid:', isValid);
    
    if (!isValid) {
      console.log('❌ [LOGIN] Invalid password');
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }
    
    console.log('🔑 [LOGIN] Generating token...');
    const token = generateToken(user.id);
    
    console.log('🔍 [LOGIN] Getting user with wallet...');
    const userWithWallet = await findUserById(user.id);
    
    console.log('✅ [LOGIN] Login successful for:', user.email);
    res.json({
      success: true,
      message: 'Connexion réussie',
      data: { user: userWithWallet, token }
    });
  } catch (error) {
    console.error('❌ [LOGIN] Error:', error);
    console.error('❌ [LOGIN] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur de connexion'
    });
  }
};

const getMe = async (req, res) => {
  try {
    console.log('👤 [GETME] User ID:', req.userId);
    const user = await findUserById(req.userId);
    if (!user) {
      console.log('❌ [GETME] User not found');
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }
    
    console.log('✅ [GETME] User found');
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('❌ [GETME] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement du profil'
    });
  }
};

module.exports = { register, login, getMe };
