/* js/dashboard.js */

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }
    loadUserData();
    loadWalletData();
    loadRecentTransactions();
    loadCryptoPrices();
    setupModalEvents();
});

/* (loadUserData, loadWalletData, loadRecentTransactions, loadCryptoPrices,
   setupModalEvents, openModal/closeModal, form getters, formatNumber,
   formatDate, getTransactionIcon, generateDepositAddress, copyAddress
   restent identiques à la version existante — non reproduits ici pour la
   lisibilité, garde-les tels quels.) */

/* =====================================================================
   Réseaux mobile money par pays — UTILISÉ UNIQUEMENT POUR LA VENTE
   (réception manuelle). Pour l'ACHAT, les opérateurs viennent maintenant
   de l'API SebPay (voir loadOperatorsForCountry).
   ===================================================================== */
const paymentNetworks = {
    "Burkina Faso": ["Orange Money BF", "Moov Africa BF", "Coris Money"],
    "Côte d'Ivoire": ["MTN Money CI", "Orange Money CI", "Moov Money CI", "Wave CI"],
    "Sénégal": ["Orange Money SN", "Free Money SN", "Wizall Money", "E-Money"],
    "Mali": ["Orange Money ML", "Moov Money ML", "Sama Money"],
    "Bénin": ["MTN Momo BJ", "Moov Money BJ"],
    "Togo": ["Moov T-Mobile", "TMoney Togo"],
    "Niger": ["Airtel Money NE", "Moov Money NE", "Orange Money NE"],
    "Guinée": ["Orange Money GN", "MTN Money GN"]
};

// Codes pays attendus par l'API SebPay (BJ, CI, SN... — voir doc "Pays supportés").
const countryCodes = {
    "Burkina Faso": "BF",
    "Côte d'Ivoire": "CI",
    "Sénégal": "SN",
    "Mali": "ML",
    "Bénin": "BJ",
    "Togo": "TG",
    "Niger": "NE",
    "Guinée": "GN"
};

const cryptoRates = { USDT: 592, BTC: 35000000, ETH: 2200000, BNB: 350000 };

function countryOptions() { return Object.keys(paymentNetworks).map(c => `<option value="${c}">${c}</option>`).join(''); }
function cryptoOptions() { return Object.keys(cryptoRates).map(c => `<option value="${c}">${c}</option>`).join(''); }

/* =====================================================================
   ACHAT — flux SebPay réel avec confirmation + gestion OTP
   ===================================================================== */

async function renderTradeForm(type) {
    if (type === 'vente') return renderVenteForm();
    return renderAchatForm();
}

async function renderAchatForm() {
    document.getElementById('mainContent').innerHTML = backLink() + `
        <div class="buy-container">
            <div class="buy-box">
                <div class="section-header-flex" style="margin-bottom: 20px;">
                    <h3>Acheter de la crypto</h3>
                </div>
                <div class="rate-info">
                    <span>Taux d'achat :</span> <span id="rateLabel">1 USDT = 592 FCFA</span>
                </div>
                <form id="achatForm">
                    <div class="form-field">
                        <label>1. Vous donnez (FCFA)</label>
                        <div class="input-group">
                            <input type="number" min="0" step="any" id="cfaInput" placeholder="Ex: 59200" oninput="calcFromCFA()" required>
                            <select style="background:var(--card);"><option>FCFA</option></select>
                        </div>
                    </div>

                    <div class="form-field">
                        <label>2. Vous recevez (Crypto)</label>
                        <div class="input-group">
                            <input type="number" min="0" step="any" id="cryptoOutput" placeholder="0.0000" oninput="calcFromCrypto()" required>
                            <select id="cryptoSelect" onchange="updateRateLabel(); calcFromCFA();">${cryptoOptions()}</select>
                        </div>
                    </div>

                    <div class="form-field">
                        <label>3. Pays de résidence</label>
                        <div class="input-group">
                            <select id="achatCountrySelect" onchange="loadOperatorsForCountry()" style="width:100%; border-left:none;">${countryOptions()}</select>
                        </div>
                    </div>

                    <div class="form-field">
                        <label>4. Opérateur Mobile Money</label>
                        <div class="input-group">
                            <select id="operatorSelect" style="width:100%; border-left:none;">
                                <option value="">Chargement des opérateurs...</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-field">
                        <label>5. Numéro de téléphone (Mobile Money)</label>
                        <div class="input-group">
                            <input type="tel" id="phoneNumber" placeholder="Ex: +226 00 00 00 00" required style="width:100%;">
                        </div>
                    </div>

                    <button type="submit" class="btn-submit" id="achatSubmitBtn">Acheter maintenant</button>
                </form>

                <div id="sebpayStatusBox" style="display:none; margin-top:16px;"></div>
            </div>
        </div>
    `;
    document.getElementById('achatForm').addEventListener('submit', handleAchatSubmit);
    updateRateLabel();
    await loadOperatorsForCountry();
}

// Charge les opérateurs réels de SebPay pour le pays sélectionné, et
// mémorise otp_required / ussd_code sur chaque <option> pour pouvoir
// afficher dynamiquement le champ OTP (voir updateOtpField).
async function loadOperatorsForCountry() {
    const countryName = document.getElementById('achatCountrySelect').value;
    const countryCode = countryCodes[countryName];
    const select = document.getElementById('operatorSelect');
    select.innerHTML = `<option value="">Chargement...</option>`;
    try {
        const res = await API.sebpay.getOperators(countryCode);
        const operators = res.operators || [];
        if (operators.length === 0) {
            select.innerHTML = `<option value="">Aucun opérateur disponible pour ce pays</option>`;
            return;
        }
        select.innerHTML = operators.map(op =>
            `<option value="${op.slug}"
                     data-name="${op.name || op.slug}"
                     data-otp-required="${!!op.otp_required}"
                     data-ussd-code="${op.ussd_code || ''}">
                ${op.name || op.slug}
             </option>`
        ).join('');
        select.onchange = updateOtpField;
        updateOtpField();
    } catch (e) {
        select.innerHTML = `<option value="">Erreur de chargement des opérateurs</option>`;
        showToast(e.message);
    }
}

// Affiche/masque dynamiquement le champ OTP selon l'opérateur choisi
// (ex: Orange Money BF/CI/SN exigent un code USSD — voir doc "Vérification OTP").
function updateOtpField() {
    const select = document.getElementById('operatorSelect');
    const opt = select.selectedOptions[0];
    const otpRequired = opt && opt.dataset.otpRequired === 'true';
    const ussdCode = opt ? opt.dataset.ussdCode : '';

    let otpBox = document.getElementById('otpFieldWrapper');
    if (!otpRequired) {
        if (otpBox) otpBox.remove();
        return;
    }
    if (!otpBox) {
        otpBox = document.createElement('div');
        otpBox.id = 'otpFieldWrapper';
        otpBox.className = 'form-field';
        document.getElementById('achatForm').insertBefore(otpBox, document.getElementById('achatSubmitBtn'));
    }
    otpBox.innerHTML = `
        <label>Code OTP</label>
        <div class="info-box" style="margin-bottom:8px;">
            Composez <strong>${ussdCode}</strong> sur votre téléphone pour recevoir votre code.
        </div>
        <div class="input-group">
            <input type="text" id="otpCode" placeholder="Code reçu par USSD" required>
        </div>
    `;
}

function updateRateLabel() {
    const select = document.getElementById('cryptoSelect');
    const crypto = select ? select.value : 'USDT';
    const rate = cryptoRates[crypto];
    const label = document.getElementById('rateLabel');
    if (label) label.textContent = `1 ${crypto} = ${rate.toLocaleString('fr-FR')} FCFA`;
}

function currentTradeCrypto() {
    const select = document.getElementById('cryptoSelect');
    return select ? select.value : 'USDT';
}

function calcFromCFA() {
    const cfaInput = document.getElementById('cfaInput').value;
    const cryptoOutput = document.getElementById('cryptoOutput');
    const rate = cryptoRates[currentTradeCrypto()];
    cryptoOutput.value = (cfaInput && !isNaN(cfaInput)) ? (cfaInput / rate).toFixed(6) : '';
}

function calcFromCrypto() {
    const cryptoInput = document.getElementById('cryptoOutput').value;
    const cfaInput = document.getElementById('cfaInput');
    const rate = cryptoRates[currentTradeCrypto()];
    cfaInput.value = (cryptoInput && !isNaN(cryptoInput)) ? Math.round(cryptoInput * rate) : '';
}

async function handleAchatSubmit(event) {
    event.preventDefault();
    const btn = document.getElementById('achatSubmitBtn');
    btn.disabled = true;
    btn.textContent = 'Envoi de la demande de paiement...';

    try {
        const crypto = currentTradeCrypto();
        const cryptoAmount = parseFloat(document.getElementById('cryptoOutput').value);
        const operatorSelect = document.getElementById('operatorSelect');
        const operator = operatorSelect.value;
        const operatorName = operatorSelect.selectedOptions[0]?.dataset.name || operator;
        const phone = document.getElementById('phoneNumber').value;
        const countryName = document.getElementById('achatCountrySelect').value;
        const country = countryCodes[countryName];
        const otpEl = document.getElementById('otpCode');
        const otpCode = otpEl ? otpEl.value : undefined;

        if (!cryptoAmount) throw new Error('Merci de renseigner un montant valide.');
        if (!operator) throw new Error('Merci de sélectionner un opérateur.');
        if (otpEl && !otpCode) throw new Error('Merci de renseigner le code OTP reçu par USSD.');

        const res = await API.sebpay.collect({ phone, operator, operatorName, country, crypto, cryptoAmount, otpCode });

        showSebpayStatus(res.transaction, res.message, res.providerLink);
        btn.textContent = 'Demande envoyée';
        pollSebpayStatus(res.transaction.id);
    } catch (e) {
        showToast(e.message);
        btn.disabled = false;
        btn.textContent = 'Acheter maintenant';
    }
}

function showSebpayStatus(tx, message, providerLink) {
    const box = document.getElementById('sebpayStatusBox');
    box.style.display = 'block';
    box.innerHTML = `
        <div class="info-box">
            ${message || '📱 Veuillez valider le paiement sur votre téléphone Mobile Money.'}
        </div>
        ${providerLink ? `<a href="${providerLink}" target="_blank" class="btn-submit" style="display:block; text-align:center; text-decoration:none;">Ouvrir le lien de paiement</a>` : ''}
        <div id="sebpayStatusText" class="settings-row-sub" style="margin-top:10px;">En attente de confirmation du paiement...</div>
    `;
}

// Poll toutes les 4s ; s'arrête dès que le statut n'est plus 'en_attente'
// ou après un nombre maximal de tentatives (évite un polling infini si
// l'utilisateur quitte l'onglet sans jamais confirmer).
function pollSebpayStatus(txId) {
    let attempts = 0;
    const maxAttempts = 45; // ~3 minutes à 4s d'intervalle
    const statusText = document.getElementById('sebpayStatusText');

    clearInterval(window.__sebpayPollTimer);
    window.__sebpayPollTimer = setInterval(async () => {
        attempts++;
        try {
            const res = await API.sebpay.getStatus(txId);
            const status = res.transaction.status;

            if (status !== 'en_attente') {
                clearInterval(window.__sebpayPollTimer);
                if (status === 'termine') {
                    showToast('Paiement confirmé, crypto créditée 🎉');
                } else {
                    showToast('Le paiement a échoué ou a été refusé.');
                }
                loadWalletData();
                loadRecentTransactions();
                if (statusText) statusText.textContent = status === 'termine' ? 'Paiement confirmé.' : 'Paiement échoué.';
                return;
            }

            if (attempts >= maxAttempts) {
                clearInterval(window.__sebpayPollTimer);
                if (statusText) statusText.textContent = "Toujours en attente — vous pouvez fermer cette page, la transaction reste visible dans l'historique.";
            }
        } catch (e) {
            console.error('Erreur de polling SebPay:', e);
        }
    }, 4000);
}

/* =====================================================================
   VENTE — inchangé (paiement manuel, pas de SebPay)
   ===================================================================== */

async function renderVenteForm() {
    document.getElementById('mainContent').innerHTML = backLink() + `
        <div class="buy-container">
            <div class="buy-box">
                <div class="section-header-flex" style="margin-bottom: 20px;">
                    <h3>Vendre de la crypto</h3>
                </div>
                <div class="rate-info">
                    <span>Taux de vente :</span> <span id="rateLabel">1 USDT = 592 FCFA</span>
                </div>
                <form id="venteForm">
                    <div class="form-field">
                        <label>1. Vous donnez (Crypto)</label>
                        <div class="input-group">
                            <input type="number" min="0" step="any" id="cryptoOutput" placeholder="0.0000" oninput="calcFromCrypto()" required>
                            <select id="cryptoSelect" onchange="updateRateLabel(); calcFromCrypto();">${cryptoOptions()}</select>
                        </div>
                    </div>

                    <div class="form-field">
                        <label>2. Vous recevez (FCFA)</label>
                        <div class="input-group">
                            <input type="number" min="0" step="any" id="cfaInput" placeholder="Ex: 59200" oninput="calcFromCFA()" required>
                            <select style="background:var(--card);"><option>FCFA</option></select>
                        </div>
                    </div>

                    <div class="form-field">
                        <label>3. Pays de résidence</label>
                        <div class="input-group">
                            <select id="countrySelect" onchange="updateNetworks()" style="width:100%; border-left:none;">${countryOptions()}</select>
                        </div>
                    </div>

                    <div class="form-field">
                        <label>4. Réseau mobile money (réception)</label>
                        <div class="input-group">
                            <select id="networkSelect" style="width:100%; border-left:none;"></select>
                        </div>
                    </div>

                    <div class="form-field">
                        <label>5. Numéro de téléphone (Mobile Money)</label>
                        <div class="input-group">
                            <input type="tel" id="phoneNumber" placeholder="Ex: +226 00 00 00 00" required style="width:100%;">
                        </div>
                    </div>

                    <button type="submit" class="btn-submit" id="venteSubmitBtn">Vendre maintenant</button>
                </form>
            </div>
        </div>
    `;
    document.getElementById('venteForm').addEventListener('submit', handleVenteSubmit);
    updateNetworks();
    updateRateLabel();
}

function updateNetworks() {
    const countrySelect = document.getElementById('countrySelect');
    const networkSelect = document.getElementById('networkSelect');
    if (!countrySelect || !networkSelect) return;
    networkSelect.innerHTML = (paymentNetworks[countrySelect.value] || [])
        .map(n => `<option value="${n}">${n}</option>`).join('');
}

async function handleVenteSubmit(event) {
    event.preventDefault();
    const btn = document.getElementById('venteSubmitBtn');
    btn.disabled = true;
    btn.textContent = 'Traitement...';

    try {
        const crypto = currentTradeCrypto();
        const cryptoAmount = parseFloat(document.getElementById('cryptoOutput').value);
        const network = document.getElementById('networkSelect').value;
        const phone = document.getElementById('phoneNumber').value;
        const country = document.getElementById('countrySelect').value;

        if (!cryptoAmount) throw new Error('Merci de renseigner un montant valide.');

        await API.transactions.trade({ type: 'vente', crypto, cryptoAmount, network, phone, country });
        showToast('Vente enregistrée. Confirmation en attente.');
        switchTab('dashboard');
    } catch (e) {
        showToast(e.message);
        btn.disabled = false;
        btn.textContent = 'Vendre maintenant';
    }
}