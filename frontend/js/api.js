// js/api.js
const API_BASE_URL = "https://backend-gnin.onrender.com/api"; // TODO: remplacer par l'URL de prod

const TOKEN_KEY = "excrypt_token";
const USER_KEY = "excrypt_user";

function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}

function getStoredUser() {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
}

function isAuthenticated() {
    return !!getToken();
}

async function apiRequest(endpoint, options = {}) {
    const token = getToken();
    const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
    };

    let res;
    try {
        res = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
    } catch (networkErr) {
        throw new Error("Impossible de contacter le serveur. Vérifiez votre connexion.");
    }

    let data = null;
    try { data = await res.json(); } catch (_) { /* réponse vide */ }

    if (!res.ok) {
        if (res.status === 401) clearSession();
        throw new Error((data && data.error) || `Erreur ${res.status}`);
    }
    return data;
}

const API = {
    auth: {
        register(payload) {
            return apiRequest("/auth/register", { method: "POST", body: JSON.stringify(payload) });
        },
        login(payload) {
            return apiRequest("/auth/login", { method: "POST", body: JSON.stringify(payload) });
        },
        me() {
            return apiRequest("/auth/me");
        }
    },
    wallet: {
        getBalances() { return apiRequest("/wallet/balances"); }
    },
    transactions: {
        list(type = "tous") { return apiRequest(`/transactions?type=${type}`); },
        trade(payload) { return apiRequest("/transactions/trade", { method: "POST", body: JSON.stringify(payload) }); },
        convert(payload) { return apiRequest("/transactions/convert", { method: "POST", body: JSON.stringify(payload) }); },
        deposit(payload) { return apiRequest("/transactions/deposit", { method: "POST", body: JSON.stringify(payload) }); },
        withdraw(payload) { return apiRequest("/transactions/withdraw", { method: "POST", body: JSON.stringify(payload) }); },
        confirm(id) { return apiRequest(`/transactions/${id}/confirm`, { method: "POST" }); },
        cancel(id) { return apiRequest(`/transactions/${id}/cancel`, { method: "POST" }); }
    },
    profile: {
        get() { return apiRequest("/profile"); },
        update(payload) { return apiRequest("/profile", { method: "PATCH", body: JSON.stringify(payload) }); },
        startKyc() { return apiRequest("/profile/kyc", { method: "POST" }); }
    },
    settings: {
        get() { return apiRequest("/settings"); },
        update(payload) { return apiRequest("/settings", { method: "PATCH", body: JSON.stringify(payload) }); },
        changePassword(payload) { return apiRequest("/settings/change-password", { method: "POST", body: JSON.stringify(payload) }); }
    },
    sebpay: {
        getOperators(country) {
            return apiRequest(`/payments/sebpay/operators?country=${encodeURIComponent(country)}`);
        },
        collect(payload) {
            return apiRequest("/payments/sebpay/collect", { method: "POST", body: JSON.stringify(payload) });
        },
        getStatus(id) {
            return apiRequest(`/payments/sebpay/collections/${id}`);
        },
        sync(id) {
            return apiRequest(`/payments/sebpay/collections/${id}/sync`, { method: "POST" });
        }
    }
};
