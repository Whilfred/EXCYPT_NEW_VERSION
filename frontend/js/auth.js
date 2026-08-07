// js/auth.js - Version sans import/export
document.addEventListener('DOMContentLoaded', () => {
    // Login Form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Register Form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
        setupPasswordValidation();
    }

    // Forgot Password Form
    const forgotForm = document.getElementById('forgotPasswordForm');
    if (forgotForm) {
        forgotForm.addEventListener('submit', handleForgotPassword);
    }

    // Toggle password visibility
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', togglePasswordVisibility);
    });

    // Check if already authenticated
    checkAuth();
});

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btn = document.getElementById('loginBtn');
    
    console.log('🔑 Login attempt for:', email);
    
    if (!email || !password) {
        showToast('Veuillez remplir tous les champs', 'error');
        return;
    }
    
    setLoading(btn, true);
    
    try {
        const response = await window.authAPI.login(email, password);
        console.log('✅ Login response:', response);
        
        if (response.success) {
            showToast('Connexion réussie !', 'success');
            localStorage.setItem('user', JSON.stringify(response.data.user));
            setTimeout(() => {
                window.location.href = '/pages/dashboard.html';
            }, 500);
        }
    } catch (error) {
        console.error('❌ Login error:', error);
        showToast(error.message || 'Erreur de connexion', 'error');
    } finally {
        setLoading(btn, false);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const formData = {
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        email: document.getElementById('email').value,
        phoneNumber: document.getElementById('phoneNumber').value,
        password: document.getElementById('password').value,
        confirmPassword: document.getElementById('confirmPassword').value
    };
    
    console.log('📝 Register attempt:', formData.email);
    
    if (!formData.firstName || !formData.lastName || !formData.email || 
        !formData.phoneNumber || !formData.password) {
        showToast('Veuillez remplir tous les champs', 'error');
        return;
    }
    
    if (formData.password !== formData.confirmPassword) {
        showToast('Les mots de passe ne correspondent pas', 'error');
        return;
    }
    
    if (formData.password.length < 8) {
        showToast('Le mot de passe doit contenir au moins 8 caractères', 'error');
        return;
    }
    
    const terms = document.getElementById('terms');
    if (!terms || !terms.checked) {
        showToast('Veuillez accepter les conditions d\'utilisation', 'error');
        return;
    }
    
    const btn = document.getElementById('registerBtn');
    setLoading(btn, true);
    
    try {
        const response = await window.authAPI.register(formData);
        console.log('✅ Register response:', response);
        
        if (response.success) {
            showToast('Inscription réussie !', 'success');
            localStorage.setItem('user', JSON.stringify(response.data.user));
            setTimeout(() => {
                window.location.href = '/pages/dashboard.html';
            }, 500);
        }
    } catch (error) {
        console.error('❌ Register error:', error);
        showToast(error.message || 'Erreur lors de l\'inscription', 'error');
    } finally {
        setLoading(btn, false);
    }
}

async function handleForgotPassword(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const btn = document.getElementById('resetBtn');
    
    if (!email) {
        showToast('Veuillez entrer votre adresse email', 'error');
        return;
    }
    
    setLoading(btn, true);
    
    try {
        const response = await window.authAPI.forgotPassword(email);
        console.log('✅ Forgot password response:', response);
        
        if (response.success) {
            document.getElementById('forgotPasswordForm').style.display = 'none';
            document.getElementById('successMessage').style.display = 'block';
        }
    } catch (error) {
        console.error('❌ Forgot password error:', error);
        showToast(error.message || 'Erreur lors de l\'envoi', 'error');
    } finally {
        setLoading(btn, false);
    }
}

function togglePasswordVisibility(e) {
    const btn = e.currentTarget;
    const input = btn.closest('.input-wrapper').querySelector('input');
    
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '👁️‍🗨️';
    } else {
        input.type = 'password';
        btn.textContent = '👁️';
    }
}

function setLoading(btn, loading) {
    if (!btn) return;
    
    const text = btn.querySelector('.btn-text');
    const loader = btn.querySelector('.btn-loader');
    
    if (loading) {
        btn.disabled = true;
        if (text) text.style.display = 'none';
        if (loader) loader.style.display = 'inline-block';
    } else {
        btn.disabled = false;
        if (text) text.style.display = 'inline-block';
        if (loader) loader.style.display = 'none';
    }
}

function setupPasswordValidation() {
    const passwordInput = document.getElementById('password');
    if (!passwordInput) return;
    
    const requirements = document.getElementById('passwordRequirements');
    if (!requirements) return;
    
    passwordInput.addEventListener('input', () => {
        const password = passwordInput.value;
        
        const lengthReq = requirements.querySelector('[data-req="length"]');
        if (password.length >= 8) {
            lengthReq.classList.add('valid');
            lengthReq.classList.remove('invalid');
        } else {
            lengthReq.classList.add('invalid');
            lengthReq.classList.remove('valid');
        }
        
        const upperReq = requirements.querySelector('[data-req="uppercase"]');
        if (/[A-Z]/.test(password)) {
            upperReq.classList.add('valid');
            upperReq.classList.remove('invalid');
        } else {
            upperReq.classList.add('invalid');
            upperReq.classList.remove('valid');
        }
        
        const numberReq = requirements.querySelector('[data-req="number"]');
        if (/\d/.test(password)) {
            numberReq.classList.add('valid');
            numberReq.classList.remove('invalid');
        } else {
            numberReq.classList.add('invalid');
            numberReq.classList.remove('valid');
        }
    });
}

function checkAuth() {
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('user');
    
    const authPages = ['login.html', 'register.html', 'forgot-password.html', 'reset-password.html'];
    const currentPage = window.location.pathname.split('/').pop();
    
    if (token && user && authPages.includes(currentPage)) {
        window.location.href = '/pages/dashboard.html';
    }
    
    if (currentPage === 'dashboard.html' && !token) {
        window.location.href = '/pages/login.html';
    }
}

// Logout function
function logout() {
    window.authAPI.logout();
    localStorage.removeItem('user');
    window.location.href = '/pages/login.html';
}

window.logout = logout;
