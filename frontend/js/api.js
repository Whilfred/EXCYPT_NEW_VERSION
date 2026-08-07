// js/api.js - Version sans export
const API_BASE_URL = 'http://localhost:5000/api';

class ApiClient {
    constructor() {
        this.baseURL = API_BASE_URL;
        this.token = localStorage.getItem('auth_token');
    }

    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('auth_token', token);
        } else {
            localStorage.removeItem('auth_token');
        }
    }

    getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
        };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            ...options,
            headers: {
                ...this.getHeaders(),
                ...options.headers,
            },
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Une erreur est survenue');
            }

            return data;
        } catch (error) {
            if (error.message === 'Failed to fetch') {
                throw new Error('Impossible de se connecter au serveur');
            }
            throw error;
        }
    }

    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    post(endpoint, body) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }

    put(endpoint, body) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body),
        });
    }

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
}

// Auth endpoints
class AuthAPI {
    constructor(client) {
        this.client = client;
    }

    async register(data) {
        return this.client.post('/auth/register', data);
    }

    async login(email, password) {
        const response = await this.client.post('/auth/login', { email, password });
        if (response.data && response.data.token) {
            this.client.setToken(response.data.token);
        }
        return response;
    }

    async forgotPassword(email) {
        return this.client.post('/auth/forgot-password', { email });
    }

    async resetPassword(token, newPassword) {
        return this.client.post('/auth/reset-password', { token, newPassword });
    }

    logout() {
        this.client.setToken(null);
    }

    getCurrentUser() {
        return this.client.get('/auth/me');
    }
}

// Transaction endpoints
class TransactionAPI {
    constructor(client) {
        this.client = client;
    }

    async getTransactions(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        return this.client.get(`/transactions?${params}`);
    }

    async createBuy(data) {
        return this.client.post('/transactions/buy', data);
    }

    async createSell(data) {
        return this.client.post('/transactions/sell', data);
    }

    async createDeposit(data) {
        return this.client.post('/transactions/deposit', data);
    }

    async createWithdrawal(data) {
        return this.client.post('/transactions/withdrawal', data);
    }

    async getTransaction(id) {
        return this.client.get(`/transactions/${id}`);
    }
}

// Wallet endpoints
class WalletAPI {
    constructor(client) {
        this.client = client;
    }

    async getWallet() {
        return this.client.get('/wallet');
    }

    async getCryptoPrices() {
        return this.client.get('/wallet/prices');
    }
}

// Admin endpoints
class AdminAPI {
    constructor(client) {
        this.client = client;
    }

    async getDashboardStats() {
        return this.client.get('/admin/dashboard');
    }

    async getPendingTransactions(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        return this.client.get(`/admin/transactions/pending?${params}`);
    }

    async validateTransaction(transactionId, data) {
        return this.client.put(`/admin/transactions/${transactionId}/validate`, data);
    }

    async updateCryptoPrice(data) {
        return this.client.put('/admin/prices', data);
    }

    async toggleUserStatus(userId) {
        return this.client.put(`/admin/users/${userId}/toggle`);
    }

    async getUsers(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        return this.client.get(`/admin/users?${params}`);
    }

    async getKYCSubmissions(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        return this.client.get(`/admin/kyc?${params}`);
    }

    async validateKYC(kycId, status, reason = '') {
        return this.client.put(`/admin/kyc/${kycId}`, { status, reason });
    }
}

// Initialize API
const apiClient = new ApiClient();
const authAPI = new AuthAPI(apiClient);
const transactionAPI = new TransactionAPI(apiClient);
const walletAPI = new WalletAPI(apiClient);
const adminAPI = new AdminAPI(apiClient);

// Toast notification system
function showToast(message, type = 'info') {
    const container = document.querySelector('.toast-container') || (() => {
        const div = document.createElement('div');
        div.className = 'toast-container';
        document.body.appendChild(div);
        return div;
    })();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    toast.innerHTML = `
        <span>${icons[type] || icons.info}</span>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// Rendre les fonctions globales
window.authAPI = authAPI;
window.transactionAPI = transactionAPI;
window.walletAPI = walletAPI;
window.adminAPI = adminAPI;
window.showToast = showToast;
