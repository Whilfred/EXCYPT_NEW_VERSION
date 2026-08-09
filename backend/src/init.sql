CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) DEFAULT '',
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(30),
    country VARCHAR(100) DEFAULT 'Burkina Faso',
    password_hash TEXT NOT NULL,
    kyc_status VARCHAR(20) NOT NULL DEFAULT 'non_verifie'
        CHECK (kyc_status IN ('non_verifie','en_attente','verifie')),
    theme VARCHAR(10) NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark','light')),
    language VARCHAR(5) NOT NULL DEFAULT 'fr',
    notif_email BOOLEAN NOT NULL DEFAULT TRUE,
    notif_sms BOOLEAN NOT NULL DEFAULT TRUE,
    notif_push BOOLEAN NOT NULL DEFAULT FALSE,
    two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS balances (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    currency VARCHAR(10) NOT NULL CHECK (currency IN ('USDT','BTC','ETH','BNB')),
    amount NUMERIC(24,8) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, currency)
);

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('achat','vente','conversion','depot','retrait')),
    status VARCHAR(20) NOT NULL DEFAULT 'en_attente'
        CHECK (status IN ('en_attente','termine','echoue')),
    crypto VARCHAR(10),
    crypto_amount NUMERIC(24,8),
    fcfa_amount NUMERIC(18,2),
    network VARCHAR(60),
    phone VARCHAR(30),
    country VARCHAR(100),
    from_currency VARCHAR(10),
    from_amount NUMERIC(24,8),
    to_currency VARCHAR(10),
    to_amount NUMERIC(24,8),
    address VARCHAR(255),
    tx_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_balances_user ON balances(user_id);
