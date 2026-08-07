/* js/dashboard.js */

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }
    
    // Load user data
    loadUserData();
    
    // Load wallet data
    loadWalletData();
    
    // Load recent transactions
    loadRecentTransactions();
    
    // Load crypto prices
    loadCryptoPrices();
    
    // Setup modal events
    setupModalEvents();
});

async function loadUserData() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (user) {
            document.querySelector('.user-name').textContent = 
                `${user.firstName} ${user.lastName}`;
            document.querySelector('.user-avatar').textContent = 
                user.firstName[0] + user.lastName[0];
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

async function loadWalletData() {
    try {
        const response = await walletAPI.getWallet();
        if (response.success) {
            const wallet = response.data;
            
            // Update balances
            document.getElementById('totalBalance').textContent = 
                `${formatNumber(wallet.balanceFCFA)} FCFA`;
            
            // Calculate total crypto value
            let totalCrypto = 0;
            wallet.cryptoAssets.forEach(asset => {
                totalCrypto += asset.amount;
            });
            document.getElementById('totalCrypto').textContent = 
                formatNumber(totalCrypto);
        }
    } catch (error) {
        console.error('Error loading wallet:', error);
        showToast('Erreur lors du chargement du portefeuille', 'error');
    }
}

async function loadRecentTransactions() {
    try {
        const response = await transactionAPI.getTransactions({ limit: 10 });
        if (response.success) {
            const transactions = response.data.transactions;
            const container = document.getElementById('recentTransactions');
            
            if (transactions.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <p>📭 Aucune transaction récente</p>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = transactions.map(tx => `
                <div class="transaction-item">
                    <div class="transaction-info">
                        <span class="transaction-icon">${getTransactionIcon(tx.type)}</span>
                        <div class="transaction-details">
                            <span class="transaction-title">${tx.description || tx.type}</span>
                            <span class="transaction-subtitle">${formatDate(tx.createdAt)}</span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span class="transaction-amount ${tx.type === 'BUY' || tx.type === 'DEPOSIT' ? 'positive' : 'negative'}">
                            ${tx.type === 'BUY' || tx.type === 'DEPOSIT' ? '+' : '-'}
                            ${formatNumber(tx.amount)} ${tx.currency}
                        </span>
                        <span class="transaction-status ${tx.status.toLowerCase()}">
                            ${tx.status}
                        </span>
                    </div>
                </div>
            `).join('');
            
            // Update stats
            document.getElementById('totalTransactions').textContent = 
                response.data.pagination.total;
            
            // Count pending transactions
            const pending = transactions.filter(tx => tx.status === 'PENDING').length;
            document.getElementById('pendingTransactions').textContent = pending;
        }
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

async function loadCryptoPrices() {
    try {
        const response = await walletAPI.getCryptoPrices();
        if (response.success) {
            // Update prices display if needed
            console.log('Crypto prices:', response.data);
        }
    } catch (error) {
        console.error('Error loading prices:', error);
    }
}

function setupModalEvents() {
    // Close modal on overlay click
    document.getElementById('modalContainer').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            closeModal();
        }
    });
    
    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
}

function openModal(action) {
    const container = document.getElementById('modalContainer');
    container.style.display = 'flex';
    
    let title = '';
    let content = '';
    
    switch(action) {
        case 'buy':
            title = 'Acheter des cryptomonnaies';
            content = getBuyModalContent();
            break;
        case 'sell':
            title = 'Vendre des cryptomonnaies';
            content = getSellModalContent();
            break;
        case 'convert':
            title = 'Convertir des cryptomonnaies';
            content = getConvertModalContent();
            break;
        case 'deposit':
            title = 'Déposer des cryptomonnaies';
            content = getDepositModalContent();
            break;
        case 'withdraw':
            title = 'Retirer des cryptomonnaies';
            content = getWithdrawModalContent();
            break;
        default:
            return;
    }
    
    container.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h2>${title}</h2>
                <button class="modal-close" onclick="closeModal()">✕</button>
            </div>
            <div class="modal-body">
                ${content}
            </div>
        </div>
    `;
}

function closeModal() {
    document.getElementById('modalContainer').style.display = 'none';
}

function getBuyModalContent() {
    return `
        <form id="buyForm" onsubmit="handleBuy(event)">
            <div class="form-group">
                <label>Cryptomonnaie</label>
                <select name="cryptoType" required>
                    <option value="BTC">Bitcoin (BTC)</option>
                    <option value="ETH">Ethereum (ETH)</option>
                    <option value="USDT">Tether (USDT)</option>
                    <option value="BNB">BNB</option>
                    <option value="XRP">XRP</option>
                    <option value="SOL">Solana (SOL)</option>
                </select>
            </div>
            <div class="form-group">
                <label>Montant (FCFA)</label>
                <input type="number" name="amountFCFA" placeholder="1000" required />
            </div>
            <div class="form-group">
                <label>Téléphone Mobile Money</label>
                <input type="tel" name="phoneNumber" placeholder="+237 6XX XX XX XX" required />
            </div>
            <div class="form-group">
                <label>Vous recevrez</label>
                <input type="text" id="estimatedCrypto" disabled value="0.00" />
            </div>
            <button type="submit" class="btn btn-primary btn-block">Demander l'achat</button>
        </form>
    `;
}

function getSellModalContent() {
    return `
        <form id="sellForm" onsubmit="handleSell(event)">
            <div class="form-group">
                <label>Cryptomonnaie</label>
                <select name="cryptoType" required>
                    <option value="BTC">Bitcoin (BTC)</option>
                    <option value="ETH">Ethereum (ETH)</option>
                    <option value="USDT">Tether (USDT)</option>
                    <option value="BNB">BNB</option>
                    <option value="XRP">XRP</option>
                    <option value="SOL">Solana (SOL)</option>
                </select>
            </div>
            <div class="form-group">
                <label>Montant (crypto)</label>
                <input type="number" name="amountCrypto" placeholder="0.00" step="0.0001" required />
            </div>
            <div class="form-group">
                <label>Téléphone Mobile Money</label>
                <input type="tel" name="phoneNumber" placeholder="+237 6XX XX XX XX" required />
            </div>
            <div class="form-group">
                <label>Vous recevrez</label>
                <input type="text" id="estimatedFCFA" disabled value="0 FCFA" />
            </div>
            <button type="submit" class="btn btn-primary btn-block">Demander la vente</button>
        </form>
    `;
}

function getConvertModalContent() {
    return `
        <form id="convertForm" onsubmit="handleConvert(event)">
            <div class="form-group">
                <label>De</label>
                <select name="fromCrypto" required>
                    <option value="BTC">Bitcoin (BTC)</option>
                    <option value="ETH">Ethereum (ETH)</option>
                    <option value="USDT">Tether (USDT)</option>
                    <option value="BNB">BNB</option>
                    <option value="XRP">XRP</option>
                    <option value="SOL">Solana (SOL)</option>
                </select>
            </div>
            <div class="form-group">
                <label>Montant</label>
                <input type="number" name="amount" placeholder="0.00" step="0.0001" required />
            </div>
            <div class="form-group">
                <label>Vers</label>
                <select name="toCrypto" required>
                    <option value="BTC">Bitcoin (BTC)</option>
                    <option value="ETH">Ethereum (ETH)</option>
                    <option value="USDT">Tether (USDT)</option>
                    <option value="BNB">BNB</option>
                    <option value="XRP">XRP</option>
                    <option value="SOL">Solana (SOL)</option>
                </select>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Convertir</button>
        </form>
    `;
}

function getDepositModalContent() {
    return `
        <div style="text-align: center; padding: 20px 0;">
            <div style="font-size: 48px; margin-bottom: 16px;">📥</div>
            <h3>Déposer des cryptomonnaies</h3>
            <p style="color: var(--text-secondary); margin-bottom: 24px;">
                Sélectionnez une cryptomonnaie pour obtenir votre adresse de dépôt
            </p>
            <div class="form-group">
                <label>Cryptomonnaie</label>
                <select name="cryptoType" id="depositCrypto" required>
                    <option value="BTC">Bitcoin (BTC)</option>
                    <option value="ETH">Ethereum (ETH)</option>
                    <option value="USDT">Tether (USDT)</option>
                    <option value="BNB">BNB</option>
                    <option value="XRP">XRP</option>
                    <option value="SOL">Solana (SOL)</option>
                </select>
            </div>
            <button onclick="generateDepositAddress()" class="btn btn-primary btn-block">
                Générer l'adresse
            </button>
            <div id="depositAddress" style="display: none; margin-top: 16px;">
                <p style="font-size: 12px; color: var(--text-secondary);">Adresse de dépôt</p>
                <code style="display: block; padding: 12px; background: var(--bg-secondary); border-radius: var(--radius); word-break: break-all;">
                    1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa
                </code>
                <button onclick="copyAddress()" class="btn btn-outline btn-block" style="margin-top: 8px;">
                    📋 Copier l'adresse
                </button>
            </div>
        </div>
    `;
}

function getWithdrawModalContent() {
    return `
        <form id="withdrawForm" onsubmit="handleWithdraw(event)">
            <div class="form-group">
                <label>Cryptomonnaie</label>
                <select name="cryptoType" required>
                    <option value="BTC">Bitcoin (BTC)</option>
                    <option value="ETH">Ethereum (ETH)</option>
                    <option value="USDT">Tether (USDT)</option>
                    <option value="BNB">BNB</option>
                    <option value="XRP">XRP</option>
                    <option value="SOL">Solana (SOL)</option>
                </select>
            </div>
            <div class="form-group">
                <label>Montant</label>
                <input type="number" name="amount" placeholder="0.00" step="0.0001" required />
            </div>
            <div class="form-group">
                <label>Adresse de destination</label>
                <input type="text" name="address" placeholder="Adresse du portefeuille" required />
            </div>
            <button type="submit" class="btn btn-primary btn-block">Demander le retrait</button>
        </form>
    `;
}

// Form handlers
async function handleBuy(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    try {
        const response = await transactionAPI.createBuy(data);
        if (response.success) {
            showToast('Demande d\'achat soumise avec succès', 'success');
            closeModal();
            loadRecentTransactions();
            loadWalletData();
        }
    } catch (error) {
        showToast(error.message || 'Erreur lors de la demande', 'error');
    }
}

async function handleSell(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    try {
        const response = await transactionAPI.createSell(data);
        if (response.success) {
            showToast('Demande de vente soumise avec succès', 'success');
            closeModal();
            loadRecentTransactions();
            loadWalletData();
        }
    } catch (error) {
        showToast(error.message || 'Erreur lors de la demande', 'error');
    }
}

async function handleConvert(e) {
    e.preventDefault();
    // Implementation for conversion
    showToast('Fonctionnalité de conversion à venir', 'info');
}

async function handleWithdraw(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    try {
        const response = await transactionAPI.createWithdrawal(data);
        if (response.success) {
            showToast('Demande de retrait soumise avec succès', 'success');
            closeModal();
            loadRecentTransactions();
            loadWalletData();
        }
    } catch (error) {
        showToast(error.message || 'Erreur lors de la demande', 'error');
    }
}

// Utility functions
function formatNumber(num) {
    if (!num) return '0.00';
    return Number(num).toLocaleString('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getTransactionIcon(type) {
    const icons = {
        BUY: '🛒',
        SELL: '💵',
        DEPOSIT: '📥',
        WITHDRAWAL: '📤',
        CONVERSION: '🔄'
    };
    return icons[type] || '📊';
}

function generateDepositAddress() {
    const addressDiv = document.getElementById('depositAddress');
    addressDiv.style.display = 'block';
}

function copyAddress() {
    const code = document.querySelector('#depositAddress code');
    if (code) {
        navigator.clipboard.writeText(code.textContent);
        showToast('Adresse copiée dans le presse-papier', 'success');
    }
}

// Make functions globally available
window.openModal = openModal;
window.closeModal = closeModal;
window.handleBuy = handleBuy;
window.handleSell = handleSell;
window.handleConvert = handleConvert;
window.handleWithdraw = handleWithdraw;
window.generateDepositAddress = generateDepositAddress;
window.copyAddress = copyAddress;
window.logout = logout;
