const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    keepAlive: true
});

pool.on('error', (err) => {
    console.error('⚠️ Erreur sur une connexion inactive du pool PG:', err.message);
});

async function query(text, params) {
    const start = Date.now();
    const res = await pool.query(text, params);
    if (process.env.NODE_ENV !== 'production') {
        console.log('SQL', { text, duration: Date.now() - start, rows: res.rowCount });
    }
    return res;
}

module.exports = { pool, query };