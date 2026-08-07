const { query } = require('../config/database');
const bcrypt = require('bcryptjs');

const createUser = async (userData) => {
  const { email, password, firstName, lastName, phoneNumber } = userData;
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const result = await query(
    'INSERT INTO users (email, password, first_name, last_name, phone_number) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, first_name, last_name, phone_number',
    [email, hashedPassword, firstName, lastName, phoneNumber]
  );
  
  const user = result.rows[0];
  
  await query('INSERT INTO wallets (user_id) VALUES ($1)', [user.id]);
  
  const cryptoTypes = ['BTC', 'ETH', 'USDT', 'BNB', 'XRP', 'SOL'];
  for (const type of cryptoTypes) {
    await query(
      'INSERT INTO crypto_assets (wallet_id, crypto_type, amount) SELECT id, $1, 0 FROM wallets WHERE user_id = $2',
      [type, user.id]
    );
  }
  
  return user;
};

const findUserByEmail = async (email) => {
  console.log('🔍 findUserByEmail called with:', email);
  const result = await query('SELECT * FROM users WHERE email = $1', [email]);
  console.log('📊 Result:', result.rows);
  return result.rows[0];
};

const findUserById = async (id) => {
  const result = await query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0];
};

module.exports = { createUser, findUserByEmail, findUserById };
