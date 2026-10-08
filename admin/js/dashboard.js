/* admin/js/dashboard.js */

if (!isAdminAuthenticated()) location.href = 'login.html';

const admin = getStoredAdmin();
if (admin) document.getElementById('adminIdLabel').textContent = admin.name || admin.email;

/* ===================== THÈME ===================== */

function refreshThemeUi() {
    const isDark = getStoredTheme() === 'dark';
    document.getElementById('themeLabel').textContent = isDark ? 'Mode sombre' : 'Mode clair';
}
function handleThemeToggle() {
    toggleTheme();
    refreshThemeUi();
    // Les graphiques lisent les couleurs CSS courantes : on les redessine
    // si on est sur le tableau de bord au moment du changement de thème.
    if (currentView === 'dashboard') loadDashboard();
}
refreshThemeUi();

/* ===================== SIDEBAR MOBILE ===================== */

function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarBackdrop').classList.add('show');
}
function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarBackdrop').classList.remove('show');
}

/* ===================== UTILITAIRES GÉNÉRAUX ===================== */

function logout() {
    clearAdminSession();
    location.href = 'login.html';
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2600);
}

function fmtDate(d) {
    return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtFcfa(n) {
    return `${Math.round(n || 0).toLocaleString('fr-FR')} FCFA`;
}
function fmtNum(n, decimals = 8) {
    const v = parseFloat(n || 0);
    return v.toLocaleString('fr-FR', { maximumFractionDigits: decimals });
}
function txAmountLabel(tx) {
    const parts = [];
    if (tx.crypto_amount) parts.push(`${parseFloat(tx.crypto_amount)} ${tx.crypto || ''}`.trim());
    if (tx.fcfa_amount) parts.push(fmtFcfa(tx.fcfa_amount));
    return parts.join(' • ') || '—';
}
function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function debounce(fn, delay) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}
function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const CURRENCIES = ['USDT', 'BTC', 'ETH', 'BNB', 'FCFA'];
const KYC_LABELS = { non_verifie: 'Non vérifié', en_attente: 'En cours', verifie: 'Vérifié' };
const KYC_BADGE = { non_verifie: 'badge-failed', en_attente: 'badge-pending', verifie: 'badge-done' };
const STATUS_LABELS = { termine: 'Terminé', en_attente: 'En attente', echoue: 'Échoué' };
const STATUS_BADGE = { termine: 'badge-done', en_attente: 'badge-pending', echoue: 'badge-failed' };
const TYPE_LABELS = {
    achat: 'Achat', vente: 'Vente', conversion: 'Conversion', depot: 'Dépôt',
    retrait: 'Retrait crypto', retrait_fcfa: 'Retrait FCFA', ajustement_admin: 'Ajustement admin'
};

/* ===================== GRAPHIQUES SVG (sans dépendance) ===================== */

function svgDonut(segments, size = 150) {
    const total = segments.reduce((s, x) => s + x.value, 0);
    const r = size / 2 - 12;
    const cx = size / 2, cy = size / 2;
    const circumference = 2 * Math.PI * r;

    if (!total) {
        return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
            <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${cssVar('--border')}" stroke-width="18" />
        </svg>`;
    }

    let offset = 0;
    let circles = '';
    segments.filter(s => s.value > 0).forEach((seg) => {
        const frac = seg.value / total;
        const len = frac * circumference;
        circles += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="18"
            stroke-dasharray="${len} ${circumference - len}" stroke-dashoffset="${-offset}"
            transform="rotate(-90 ${cx} ${cy})"><title>${esc(seg.label)}: ${seg.value}</title></circle>`;
        offset += len;
    });
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${circles}
        <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="20" font-weight="800" fill="${cssVar('--text')}">${total}</text>
    </svg>`;
}

function svgBarChart(items, width = 460, height = 200) {
    const paddingLeft = 8, paddingRight = 8, paddingTop = 10, paddingBottom = 34;
    const max = Math.max(...items.map((i) => i.value), 1);
    const chartW = width - paddingLeft - paddingRight;
    const chartH = height - paddingTop - paddingBottom;
    const gap = chartW / items.length;
    const barW = Math.min(gap * 0.55, 46);

    let bars = `<line x1="${paddingLeft}" y1="${paddingTop + chartH}" x2="${width - paddingRight}" y2="${paddingTop + chartH}" stroke="${cssVar('--border')}" stroke-width="1" />`;
    items.forEach((it, i) => {
        const h = (it.value / max) * chartH;
        const x = paddingLeft + i * gap + (gap - barW) / 2;
        const y = paddingTop + chartH - h;
        bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(h, 1).toFixed(1)}" rx="4" fill="${it.color}"><title>${esc(it.label)}: ${it.value}</title></rect>`;
        bars += `<text x="${(x + barW / 2).toFixed(1)}" y="${height - 16}" text-anchor="middle" font-size="10" fill="${cssVar('--muted')}">${esc(it.label)}</text>`;
        bars += `<text x="${(x + barW / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="${cssVar('--text')}">${it.value}</text>`;
    });
    return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}">${bars}</svg>`;
}

const CHART_PALETTE = ['--accent', '--green', '--amber', '--red'];
const EXTRA_COLORS = ['#6366f1', '#06b6d4', '#ec4899'];
function colorForIndex(i) {
    if (i < CHART_PALETTE.length) return cssVar(CHART_PALETTE[i]);
    return EXTRA_COLORS[(i - CHART_PALETTE.length) % EXTRA_COLORS.length];
}

/* ===================== MODAL ===================== */

function openModal(html) {
    document.getElementById('modalBody').innerHTML = html;
    document.getElementById('modalOverlay').classList.add('show');
}
function closeModal() {
    document.getElementById('modalOverlay').classList.remove('show');
    document.getElementById('modalBody').innerHTML = '';
}

/* ===================== NAVIGATION ===================== */

let currentView = 'dashboard';

function setActiveMenu(view) {
    ['Dashboard', 'Clients', 'Transactions', 'Rates', 'Admins'].forEach((v) => {
        document.getElementById(`menu${v}`).classList.toggle('active', v.toLowerCase() === view);
    });
}

async function switchView(view) {
    currentView = view;
    setActiveMenu(view);
    closeSidebar();
    if (view === 'dashboard') await renderDashboard();
    else if (view === 'clients') await renderClients();
    else if (view === 'transactions') await renderTransactions();
    else if (view === 'rates') await renderRates();
    else if (view === 'admins') await renderAdmins();
}

function renderPagination(containerId, state, total, reload) {
    const container = document.getElementById(containerId);
    const totalPages = Math.max(Math.ceil(total / state.pageSize), 1);
    container.innerHTML = `
        <button ${state.page <= 1 ? 'disabled' : ''} id="prevPageBtn">← Précédent</button>
        <span>Page ${state.page} / ${totalPages} (${total} résultats)</span>
        <button ${state.page >= totalPages ? 'disabled' : ''} id="nextPageBtn">Suivant →</button>
    `;
    const prev = document.getElementById('prevPageBtn');
    const next = document.getElementById('nextPageBtn');
    if (prev) prev.addEventListener('click', () => { state.page--; reload(); });
    if (next) next.addEventListener('click', () => { state.page++; reload(); });
}

switchView('dashboard');

/* ===================== TABLEAU DE BORD ===================== */

async function renderDashboard() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `
        <div class="topbar"><h1>Tableau de bord</h1></div>
        <div id="kpiGrid" class="kpi-grid"><div class="empty">Chargement...</div></div>
        <div class="charts-grid">
            <div class="chart-panel">
                <h3>Transactions par statut</h3>
                <div id="statusChart" style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;"></div>
            </div>
            <div class="chart-panel">
                <h3>Transactions par type</h3>
                <div id="typeChart"></div>
            </div>
        </div>
    `;
    await loadDashboard();
}

async function loadDashboard() {
    try {
        const stats = await AdminAPI.getDashboardStats();

        document.getElementById('kpiGrid').innerHTML = `
            <div class="kpi-card">
                <div class="kpi-label">Total clients</div>
                <div class="kpi-value">${stats.usersCount}</div>
                <div class="kpi-sub">${stats.newUsersLast7Days} nouveaux (7 derniers jours)</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Clients actifs</div>
                <div class="kpi-value" style="color:var(--green)">${stats.activeUsersCount}</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Clients bloqués</div>
                <div class="kpi-value" style="color:var(--red)">${stats.blockedUsersCount}</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Volume aujourd'hui</div>
                <div class="kpi-value">${fmtFcfa(stats.volumeTodayFcfa)}</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Volume ce mois</div>
                <div class="kpi-value">${fmtFcfa(stats.volumeMonthFcfa)}</div>
            </div>
        `;

        const statusColors = { en_attente: cssVar('--amber'), termine: cssVar('--green'), echoue: cssVar('--red') };
        const statusSegments = stats.transactionsByStatus.map((s) => ({
            label: STATUS_LABELS[s.status] || s.status, value: s.count, color: statusColors[s.status] || cssVar('--muted')
        }));
        document.getElementById('statusChart').innerHTML = `
            ${svgDonut(statusSegments)}
            <div class="legend">
                ${statusSegments.length ? statusSegments.map((s) => `
                    <div class="legend-item"><span class="legend-dot" style="background:${s.color}"></span>${esc(s.label)}<span class="legend-value">${s.value}</span></div>
                `).join('') : '<span style="color:var(--muted)">Aucune donnée</span>'}
            </div>
        `;

        const typeItems = stats.transactionsByType.map((t, i) => ({
            label: TYPE_LABELS[t.type] || t.type, value: t.count, color: colorForIndex(i)
        }));
        document.getElementById('typeChart').innerHTML = typeItems.length
            ? svgBarChart(typeItems)
            : '<div class="empty">Aucune donnée</div>';
    } catch (e) {
        document.getElementById('kpiGrid').innerHTML = `<div class="empty">${esc(e.message)}</div>`;
    }
}

/* ===================== CLIENTS ===================== */

let usersState = { search: '', page: 1, pageSize: 20 };

async function renderClients() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `
        <div class="topbar">
            <h1>Clients</h1>
            <span class="count" id="userCount"></span>
        </div>
        <div class="toolbar">
            <input type="text" id="userSearch" placeholder="Rechercher (nom, e-mail, téléphone)..." value="${esc(usersState.search)}">
            <button class="btn" id="exportUsersBtn">⬇ Exporter CSV</button>
        </div>
        <div class="panel" style="padding:0;overflow-x:auto;">
            <table>
                <thead><tr><th>Nom</th><th>Contact</th><th>Pays</th><th>KYC</th><th>Statut</th><th>Inscrit le</th><th>Action</th></tr></thead>
                <tbody id="usersBody"><tr><td colspan="7" class="empty">Chargement...</td></tr></tbody>
            </table>
        </div>
        <div class="pagination" id="usersPagination"></div>
    `;
    document.getElementById('userSearch').addEventListener('input', debounce((e) => {
        usersState.search = e.target.value; usersState.page = 1; loadUsers();
    }, 400));
    document.getElementById('exportUsersBtn').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true; btn.textContent = 'Export...';
        try {
            await AdminAPI.exportUsersCsv(usersState.search);
        } catch (err) { showToast(err.message); }
        btn.disabled = false; btn.textContent = '⬇ Exporter CSV';
    });
    await loadUsers();
}

async function loadUsers() {
    const tbody = document.getElementById('usersBody');
    try {
        const { users, total } = await AdminAPI.getUsers(usersState);
        document.getElementById('userCount').textContent = `${total} client${total > 1 ? 's' : ''}`;
        if (!users.length) {
            tbody.innerHTML = `<tr><td colspan="7" class="empty">Aucun client trouvé</td></tr>`;
        } else {
            tbody.innerHTML = users.map((u) => `
                <tr class="clickable" onclick="openClientDetail(${u.id})">
                    <td>${esc(u.first_name)} ${esc(u.last_name)}</td>
                    <td><div>${esc(u.email)}</div><div class="cell-muted">${esc(u.phone) || '—'}</div></td>
                    <td>${esc(u.country) || '—'}</td>
                    <td><span class="badge ${KYC_BADGE[u.kyc_status] || 'badge-pending'}">${KYC_LABELS[u.kyc_status] || u.kyc_status}</span></td>
                    <td><span class="badge ${u.is_active ? 'badge-active' : 'badge-blocked'}">${u.is_active ? 'Actif' : 'Bloqué'}</span></td>
                    <td class="cell-muted">${fmtDate(u.created_at)}</td>
                    <td><button class="btn-sm toggle" onclick="event.stopPropagation(); toggleUser(${u.id}, this)">${u.is_active ? 'Bloquer' : 'Débloquer'}</button></td>
                </tr>
            `).join('');
        }
        renderPagination('usersPagination', usersState, total, loadUsers);
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty">${esc(e.message)}</td></tr>`;
    }
}

async function toggleUser(id, btn) {
    btn.disabled = true;
    try {
        await AdminAPI.toggleUser(id);
        showToast('Statut mis à jour');
        await loadUsers();
    } catch (e) { showToast(e.message); btn.disabled = false; }
}

/* ===== Fiche client (détail + ajustement de solde) ===== */

async function openClientDetail(userId) {
    openModal(`<div class="empty">Chargement...</div>`);
    try {
        const { user, balances, transactions } = await AdminAPI.getUserDetail(userId);
        renderClientDetail(user, balances, transactions);
    } catch (e) {
        openModal(`<div class="modal-header"><h2>Erreur</h2><button class="modal-close" onclick="closeModal()">✕</button></div><div class="empty">${esc(e.message)}</div>`);
    }
}

function renderClientDetail(user, balances, transactions) {
    const balanceChips = CURRENCIES.map((cur) => `
        <div class="balance-chip"><div class="cur">${cur}</div><div class="amt">${fmtNum(balances[cur], cur === 'FCFA' ? 0 : 6)}</div></div>
    `).join('');

    const txRows = transactions.length ? transactions.slice(0, 30).map((tx) => `
        <tr>
            <td>${TYPE_LABELS[tx.type] || tx.type}</td>
            <td>${txAmountLabel(tx)}</td>
            <td><span class="badge ${STATUS_BADGE[tx.status]}">${STATUS_LABELS[tx.status]}</span></td>
            <td class="cell-muted">${fmtDate(tx.created_at)}</td>
        </tr>
    `).join('') : `<tr><td colspan="4" class="empty">Aucune transaction</td></tr>`;

    openModal(`
        <div class="modal-header">
            <h2>${esc(user.first_name)} ${esc(user.last_name)}</h2>
            <button class="modal-close" onclick="closeModal()">✕</button>
        </div>

        <div class="modal-section">
            <div class="info-grid">
                <div><span>E-mail</span>${esc(user.email)}</div>
                <div><span>Téléphone</span>${esc(user.phone) || '—'}</div>
                <div><span>Pays</span>${esc(user.country) || '—'}</div>
                <div><span>KYC</span><span class="badge ${KYC_BADGE[user.kyc_status]}">${KYC_LABELS[user.kyc_status]}</span></div>
                <div><span>Statut</span><span class="badge ${user.is_active ? 'badge-active' : 'badge-blocked'}">${user.is_active ? 'Actif' : 'Bloqué'}</span></div>
                <div><span>Inscrit le</span>${fmtDate(user.created_at)}</div>
            </div>
        </div>

        <div class="modal-section">
            <h4>Soldes</h4>
            <div class="balances-grid">${balanceChips}</div>
        </div>

        <div class="modal-section">
            <h4>Ajuster un solde</h4>
            <form id="adjustForm" class="form-grid">
                <div class="form-row">
                    <div class="form-field">
                        <label>Devise</label>
                        <select id="adjustCurrency">${CURRENCIES.map((c) => `<option value="${c}">${c}</option>`).join('')}</select>
                    </div>
                    <div class="form-field">
                        <label>Sens</label>
                        <select id="adjustDirection">
                            <option value="credit">Créditer (+)</option>
                            <option value="debit">Débiter (-)</option>
                        </select>
                    </div>
                    <div class="form-field">
                        <label>Montant</label>
                        <input type="number" id="adjustAmount" min="0" step="any" placeholder="0.00" required>
                    </div>
                </div>
                <div class="form-field">
                    <label>Note (optionnel)</label>
                    <input type="text" id="adjustNote" placeholder="Raison de l'ajustement...">
                </div>
                <button type="submit" class="btn primary" id="adjustSubmitBtn">Valider l'ajustement</button>
            </form>
        </div>

        <div class="modal-section" style="margin-bottom:0;">
            <h4>Historique des transactions ${transactions.length > 30 ? '(30 plus récentes)' : ''}</h4>
            <div class="tx-history">
                <table>
                    <thead><tr><th>Type</th><th>Montant</th><th>Statut</th><th>Date</th></tr></thead>
                    <tbody>${txRows}</tbody>
                </table>
            </div>
        </div>
    `);

    document.getElementById('adjustForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('adjustSubmitBtn');
        btn.disabled = true; btn.textContent = 'Validation...';
        try {
            const { balances: updated } = await AdminAPI.adjustBalance(user.id, {
                currency: document.getElementById('adjustCurrency').value,
                direction: document.getElementById('adjustDirection').value,
                amount: document.getElementById('adjustAmount').value,
                note: document.getElementById('adjustNote').value.trim()
            });
            showToast('Solde ajusté');
            const { transactions: freshTx } = await AdminAPI.getUserDetail(user.id);
            renderClientDetail(user, updated, freshTx);
            await loadUsers();
        } catch (err) {
            showToast(err.message);
            btn.disabled = false; btn.textContent = "Valider l'ajustement";
        }
    });
}

/* ===================== TRANSACTIONS ===================== */

let txState = { status: 'tous', type: 'tous', page: 1, pageSize: 20 };

async function renderTransactions() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `
        <div class="topbar"><h1>Transactions</h1><span class="count" id="txCount"></span></div>
        <div class="toolbar">
            <select id="txStatusFilter">
                <option value="tous">Tous statuts</option>
                <option value="en_attente">En attente</option>
                <option value="termine">Terminé</option>
                <option value="echoue">Échoué</option>
            </select>
            <select id="txTypeFilter">
                <option value="tous">Tous types</option>
                <option value="achat">Achat</option>
                <option value="vente">Vente</option>
                <option value="conversion">Conversion</option>
                <option value="depot">Dépôt</option>
                <option value="retrait">Retrait crypto</option>
                <option value="retrait_fcfa">Retrait FCFA</option>
                <option value="ajustement_admin">Ajustement admin</option>
            </select>
            <button class="btn" id="exportTxBtn">⬇ Exporter CSV</button>
        </div>
        <div class="panel" style="padding:0;overflow-x:auto;">
            <table>
                <thead><tr><th>Client</th><th>Type</th><th>Montant</th><th>Statut</th><th>Date</th><th>Action</th></tr></thead>
                <tbody id="txBody"><tr><td colspan="6" class="empty">Chargement...</td></tr></tbody>
            </table>
        </div>
        <div class="pagination" id="txPagination"></div>
    `;
    document.getElementById('txStatusFilter').value = txState.status;
    document.getElementById('txTypeFilter').value = txState.type;
    document.getElementById('txStatusFilter').addEventListener('change', (e) => {
        txState.status = e.target.value; txState.page = 1; loadTransactions();
    });
    document.getElementById('txTypeFilter').addEventListener('change', (e) => {
        txState.type = e.target.value; txState.page = 1; loadTransactions();
    });
    document.getElementById('exportTxBtn').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true; btn.textContent = 'Export...';
        try {
            await AdminAPI.exportTransactionsCsv({ status: txState.status, type: txState.type });
        } catch (err) { showToast(err.message); }
        btn.disabled = false; btn.textContent = '⬇ Exporter CSV';
    });
    await loadTransactions();
}

async function loadTransactions() {
    const tbody = document.getElementById('txBody');
    try {
        const { transactions, total } = await AdminAPI.getTransactions(txState);
        document.getElementById('txCount').textContent = `${total} transaction${total > 1 ? 's' : ''}`;
        if (!transactions.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="empty">Aucune transaction trouvée</td></tr>`;
        } else {
            tbody.innerHTML = transactions.map((tx) => `
                <tr class="clickable" onclick="openClientDetail(${tx.user_id})">
                    <td><div>${esc(tx.first_name)} ${esc(tx.last_name)}</div><div class="cell-muted">${esc(tx.email)}</div></td>
                    <td>${TYPE_LABELS[tx.type] || tx.type}</td>
                    <td>${txAmountLabel(tx)}</td>
                    <td><span class="badge ${STATUS_BADGE[tx.status]}">${STATUS_LABELS[tx.status]}</span></td>
                    <td class="cell-muted">${fmtDate(tx.created_at)}</td>
                    <td>
                        ${tx.status === 'en_attente' ? `
                            <div class="actions-cell">
                                <button class="btn-sm validate" onclick="event.stopPropagation(); handleValidate(${tx.id}, this)">Valider</button>
                                <button class="btn-sm reject" onclick="event.stopPropagation(); handleReject(${tx.id}, this)">Rejeter</button>
                            </div>
                        ` : '—'}
                    </td>
                </tr>
            `).join('');
        }
        renderPagination('txPagination', txState, total, loadTransactions);
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty">${esc(e.message)}</td></tr>`;
    }
}

async function handleValidate(id, btn) {
    btn.disabled = true;
    try {
        await AdminAPI.validateTransaction(id);
        showToast('Transaction validée');
        await loadTransactions();
    } catch (e) { showToast(e.message); btn.disabled = false; }
}

async function handleReject(id, btn) {
    btn.disabled = true;
    try {
        await AdminAPI.rejectTransaction(id);
        showToast('Transaction rejetée');
        await loadTransactions();
    } catch (e) { showToast(e.message); btn.disabled = false; }
}

/* ===================== TAUX & FRAIS ===================== */

const CRYPTO_LIST = ['USDT', 'BTC', 'ETH', 'BNB'];

async function renderRates() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `
        <div class="topbar"><h1>Taux &amp; frais</h1></div>

        <div class="panel" style="padding:18px;margin-bottom:20px;overflow-x:auto;">
            <h3 style="font-size:.95rem;margin-bottom:14px;">Taux d'achat / vente crypto</h3>
            <table class="rates-table" id="ratesTable">
                <thead><tr><th>Devise</th><th>Taux d'achat (FCFA)</th><th>Taux de vente (FCFA)</th><th></th></tr></thead>
                <tbody><tr><td colspan="4" class="empty">Chargement...</td></tr></tbody>
            </table>
        </div>

        <div class="panel" style="padding:18px;">
            <h3 style="font-size:.95rem;margin-bottom:14px;">Frais de retrait FCFA (Mobile Money)</h3>
            <form id="feesForm" class="form-grid" style="max-width:520px;">
                <div class="form-row">
                    <div class="form-field">
                        <label>Frais (%)</label>
                        <input type="number" id="feePercent" min="0" step="any" required>
                    </div>
                    <div class="form-field">
                        <label>Frais minimum (FCFA)</label>
                        <input type="number" id="feeMin" min="0" step="any" required>
                    </div>
                    <div class="form-field">
                        <label>Retrait minimum (FCFA)</label>
                        <input type="number" id="feeMinWithdrawal" min="0" step="any" required>
                    </div>
                </div>
                <button type="submit" class="btn primary" id="feesSubmitBtn" style="width:fit-content;">Enregistrer les frais</button>
            </form>
        </div>
    `;
    await loadRates();

    document.getElementById('feesForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('feesSubmitBtn');
        btn.disabled = true; btn.textContent = 'Enregistrement...';
        try {
            await AdminAPI.updateFees({
                percent: parseFloat(document.getElementById('feePercent').value),
                minFee: parseFloat(document.getElementById('feeMin').value),
                minWithdrawal: parseFloat(document.getElementById('feeMinWithdrawal').value)
            });
            showToast('Frais mis à jour');
        } catch (err) { showToast(err.message); }
        btn.disabled = false; btn.textContent = 'Enregistrer les frais';
    });
}

async function loadRates() {
    const tbody = document.querySelector('#ratesTable tbody');
    try {
        const { buyRates, sellRates, fees } = await AdminAPI.getRates();
        tbody.innerHTML = CRYPTO_LIST.map((cur) => `
            <tr>
                <td><strong>${cur}</strong></td>
                <td><input type="number" min="0" step="any" id="buy-${cur}" value="${buyRates[cur]}"></td>
                <td><input type="number" min="0" step="any" id="sell-${cur}" value="${sellRates[cur]}"></td>
                <td><button class="btn-sm toggle" onclick="saveRate('${cur}', this)">Enregistrer</button></td>
            </tr>
        `).join('');

        document.getElementById('feePercent').value = fees.percent;
        document.getElementById('feeMin').value = fees.minFee;
        document.getElementById('feeMinWithdrawal').value = fees.minWithdrawal;
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty">${esc(e.message)}</td></tr>`;
    }
}

async function saveRate(currency, btn) {
    btn.disabled = true;
    try {
        const buyRate = parseFloat(document.getElementById(`buy-${currency}`).value);
        const sellRate = parseFloat(document.getElementById(`sell-${currency}`).value);
        await AdminAPI.updateRate(currency, { buyRate, sellRate });
        showToast(`Taux ${currency} mis à jour`);
    } catch (e) { showToast(e.message); }
    btn.disabled = false;
}

/* ===================== ADMINISTRATEURS ===================== */

async function renderAdmins() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `
        <div class="topbar"><h1>Administrateurs</h1></div>

        <div class="panel" style="padding:0;overflow-x:auto;margin-bottom:20px;">
            <table>
                <thead><tr><th>Nom</th><th>E-mail</th><th>Rôle</th><th>Créé le</th></tr></thead>
                <tbody id="adminsBody"><tr><td colspan="4" class="empty">Chargement...</td></tr></tbody>
            </table>
        </div>

        <div class="panel" style="padding:18px;">
            <h3 style="font-size:.95rem;margin-bottom:14px;">Ajouter un administrateur</h3>
            <form id="createAdminForm" class="form-grid" style="max-width:520px;">
                <div class="form-row">
                    <div class="form-field">
                        <label>Nom</label>
                        <input type="text" id="newAdminName" required>
                    </div>
                    <div class="form-field">
                        <label>E-mail</label>
                        <input type="email" id="newAdminEmail" required>
                    </div>
                </div>
                <div class="form-field">
                    <label>Mot de passe (8 caractères min.)</label>
                    <input type="password" id="newAdminPassword" minlength="8" required>
                </div>
                <button type="submit" class="btn primary" id="createAdminBtn" style="width:fit-content;">Créer l'administrateur</button>
            </form>
        </div>
    `;
    await loadAdmins();

    document.getElementById('createAdminForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('createAdminBtn');
        btn.disabled = true; btn.textContent = 'Création...';
        try {
            await AdminAPI.createAdmin({
                name: document.getElementById('newAdminName').value.trim(),
                email: document.getElementById('newAdminEmail').value.trim(),
                password: document.getElementById('newAdminPassword').value
            });
            showToast('Administrateur créé');
            e.target.reset();
            await loadAdmins();
        } catch (err) { showToast(err.message); }
        btn.disabled = false; btn.textContent = "Créer l'administrateur";
    });
}

async function loadAdmins() {
    const tbody = document.getElementById('adminsBody');
    try {
        const { admins } = await AdminAPI.getAdmins();
        tbody.innerHTML = admins.length ? admins.map((a) => `
            <tr>
                <td>${esc(a.name)}</td>
                <td>${esc(a.email)}</td>
                <td>${esc(a.role)}</td>
                <td class="cell-muted">${fmtDate(a.created_at)}</td>
            </tr>
        `).join('') : `<tr><td colspan="4" class="empty">Aucun administrateur</td></tr>`;
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty">${esc(e.message)}</td></tr>`;
    }
}
