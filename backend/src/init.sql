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


-- Migration : ajout des colonnes nécessaires à l'intégration SebPay.
-- À exécuter une seule fois sur la base existante (ne modifie pas init.sql,
-- qui reste la référence pour une base créée à partir de zéro — pensez à y
-- reporter ces colonnes si vous régénérez la base plus tard).

ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20)
        CHECK (payment_method IN ('manuel', 'sebpay')),
    ADD COLUMN IF NOT EXISTS operator_slug VARCHAR(30),
    ADD COLUMN IF NOT EXISTS provider_transaction_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS provider_link TEXT;

-- Un provider_transaction_id doit être unique s'il est renseigné (permet de
-- retrouver une transaction depuis un webhook via transaction_id SebPay).
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_provider_tx_id
    ON transactions(provider_transaction_id)
    WHERE provider_transaction_id IS NOT NULL;

-- Migration : ajout du FCFA comme solde natif stocké + retraits FCFA vers
-- Mobile Money. À exécuter une seule fois sur la base existante.

ALTER TABLE balances DROP CONSTRAINT IF EXISTS balances_currency_check;
ALTER TABLE balances ADD CONSTRAINT balances_currency_check
    CHECK (currency IN ('USDT','BTC','ETH','BNB','FCFA'));

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
    CHECK (type IN ('achat','vente','conversion','depot','retrait','retrait_fcfa'));

ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(18,2);
    
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS crypto_network VARCHAR(60);