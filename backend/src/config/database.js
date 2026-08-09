const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
    console.error('Erreur inattendue du pool PostgreSQL', err);
    process.exit(-1);
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
