// admin/js/admin-api.js
const API_BASE_URL = "https://excypt-new-version-1.onrender.com/api";
const ADMIN_TOKEN_KEY = "excrypt_admin_token";
const ADMIN_KEY = "excrypt_admin";
const THEME_KEY = "excrypt_admin_theme";

function getAdminToken() {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
}

function setAdminSession(token, admin) {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    if (admin) localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
}

function clearAdminSession() {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_KEY);
}

function getStoredAdmin() {
    const raw = localStorage.getItem(ADMIN_KEY);
    return raw ? JSON.parse(raw) : null;
}

function isAdminAuthenticated() {
    return !!getAdminToken();
}

async function adminRequest(endpoint, options = {}) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    const token = getAdminToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${API_BASE_URL}/admin${endpoint}`, { ...options, headers });

    let data = null;
    try { data = await response.json(); } catch (_) { /* pas de corps JSON */ }

    if (response.status === 401 || response.status === 403) {
        clearAdminSession();
        if (!location.pathname.endsWith('login.html')) {
            location.href = 'login.html';
        }
    }

    if (!response.ok) {
        throw new Error((data && data.error) || "Une erreur est survenue.");
    }
    return data;
}

// Télécharge un endpoint qui répond en CSV (nécessite le header
// Authorization, donc on ne peut pas simplement faire un <a href>).
async function adminDownload(endpoint, fallbackFilename) {
    const token = getAdminToken();
    const response = await fetch(`${API_BASE_URL}/admin${endpoint}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    });

    if (response.status === 401 || response.status === 403) {
        clearAdminSession();
        location.href = 'login.html';
        return;
    }
    if (!response.ok) {
        let msg = "Erreur lors du téléchargement.";
        try { const data = await response.json(); if (data && data.error) msg = data.error; } catch (_) {}
        throw new Error(msg);
    }

    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : fallbackFilename;

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

const AdminAPI = {
    login(email, password) {
        return adminRequest('/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    },
    me() {
        return adminRequest('/me');
    },

    // Dashboard
    getDashboardStats() {
        return adminRequest('/dashboard/stats');
    },

    // Clients
    getUsers({ search = '', page = 1, pageSize = 20 } = {}) {
        const params = new URLSearchParams({ search, page, pageSize });
        return adminRequest(`/users?${params}`);
    },
    getUserDetail(userId) {
        return adminRequest(`/users/${userId}`);
    },
    toggleUser(userId) {
        return adminRequest(`/users/${userId}/toggle`, { method: 'PUT' });
    },
    adjustBalance(userId, { currency, amount, direction, note }) {
        return adminRequest(`/users/${userId}/wallet/adjust`, {
            method: 'PUT',
            body: JSON.stringify({ currency, amount, direction, note })
        });
    },
    exportUsersCsv(search = '') {
        const params = new URLSearchParams({ search });
        return adminDownload(`/users/export?${params}`, 'clients.csv');
    },

    // Transactions
    getTransactions({ status = 'tous', type = 'tous', page = 1, pageSize = 20 } = {}) {
        const params = new URLSearchParams({ status, type, page, pageSize });
        return adminRequest(`/transactions?${params}`);
    },
    validateTransaction(id) {
        return adminRequest(`/transactions/${id}/validate`, { method: 'PUT' });
    },
    rejectTransaction(id) {
        return adminRequest(`/transactions/${id}/reject`, { method: 'PUT' });
    },
    exportTransactionsCsv({ status = 'tous', type = 'tous' } = {}) {
        const params = new URLSearchParams({ status, type });
        return adminDownload(`/transactions/export?${params}`, 'transactions.csv');
    },

    // Taux & frais
    getRates() {
        return adminRequest('/rates');
    },
    updateRate(currency, { buyRate, sellRate }) {
        return adminRequest(`/rates/${currency}`, { method: 'PUT', body: JSON.stringify({ buyRate, sellRate }) });
    },
    updateFees({ percent, minFee, minWithdrawal }) {
        return adminRequest('/fees', { method: 'PUT', body: JSON.stringify({ percent, minFee, minWithdrawal }) });
    },

    // Administrateurs
    getAdmins() {
        return adminRequest('/admins');
    },
    createAdmin({ name, email, password }) {
        return adminRequest('/admins', { method: 'POST', body: JSON.stringify({ name, email, password }) });
    }
};

/* ===================== THÈME (clair / sombre) ===================== */

function getStoredTheme() {
    return localStorage.getItem(THEME_KEY) || 'light';
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
    const next = getStoredTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    return next;
}

// Appliqué immédiatement à l'import du script, avant le rendu, pour
// éviter un flash de mauvais thème.
applyTheme(getStoredTheme());

window.AdminAPI = AdminAPI;
window.isAdminAuthenticated = isAdminAuthenticated;
window.getStoredAdmin = getStoredAdmin;
window.setAdminSession = setAdminSession;
window.clearAdminSession = clearAdminSession;
window.applyTheme = applyTheme;
window.toggleTheme = toggleTheme;
window.getStoredTheme = getStoredTheme;
