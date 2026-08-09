// js/auth.js
(function () {
    const DASHBOARD_URL = "../pages/dashboard.html"; // pages/ -> racine
    const LOGIN_URL = "../pages/login.html";

    function ensureToastContainer() {
        let container = document.querySelector(".toast-container");
        if (!container) {
            container = document.createElement("div");
            container.className = "toast-container";
            document.body.appendChild(container);
        }
        return container;
    }

    function showToast(message, type = "error") {
        const container = ensureToastContainer();
        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add("show"));
        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => toast.remove(), 250);
        }, 3500);
    }

    function setLoading(button, loading) {
        if (!button) return;
        const text = button.querySelector(".btn-text");
        const loader = button.querySelector(".btn-loader");
        button.disabled = loading;
        if (text) text.style.display = loading ? "none" : "";
        if (loader) loader.style.display = loading ? "" : "none";
    }

    function setupPasswordToggle(toggleId, inputId) {
        const toggle = document.getElementById(toggleId);
        const input = document.getElementById(inputId);
        if (!toggle || !input) return;
        toggle.addEventListener("click", () => {
            const isPassword = input.type === "password";
            input.type = isPassword ? "text" : "password";
            toggle.textContent = isPassword ? "🙈" : "👁️";
        });
    }

    function setupPasswordRequirements() {
        const passwordInput = document.getElementById("password");
        const list = document.getElementById("passwordRequirements");
        if (!passwordInput || !list) return;

        passwordInput.addEventListener("input", () => {
            const value = passwordInput.value;
            const checks = {
                length: value.length >= 8,
                uppercase: /[A-Z]/.test(value),
                number: /[0-9]/.test(value)
            };
            Object.entries(checks).forEach(([key, ok]) => {
                const item = list.querySelector(`[data-req="${key}"]`);
                if (item) item.classList.toggle("valid", ok);
            });
        });
    }

    function passwordIsStrong(value) {
        return value.length >= 8 && /[A-Z]/.test(value) && /[0-9]/.test(value);
    }

    /* ---------- INSCRIPTION ---------- */
    function initRegisterForm() {
        const form = document.getElementById("registerForm");
        if (!form) return;

        setupPasswordToggle("togglePassword", "password");
        setupPasswordToggle("toggleConfirmPassword", "confirmPassword");
        setupPasswordRequirements();

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById("registerBtn");

            const firstName = document.getElementById("firstName").value.trim();
            const lastName = document.getElementById("lastName").value.trim();
            const email = document.getElementById("email").value.trim();
            const phone = document.getElementById("phoneNumber").value.trim();
            const password = document.getElementById("password").value;
            const confirmPassword = document.getElementById("confirmPassword").value;
            const termsAccepted = document.getElementById("terms").checked;

            if (!termsAccepted) return showToast("Merci d'accepter les conditions d'utilisation.");
            if (password !== confirmPassword) return showToast("Les mots de passe ne correspondent pas.");
            if (!passwordIsStrong(password)) return showToast("Le mot de passe ne respecte pas les critères requis.");

            setLoading(submitBtn, true);
            try {
                const { token, user } = await API.auth.register({ firstName, lastName, email, phone, password });
                setSession(token, user);
                showToast("Compte créé avec succès !", "success");
                window.location.href = DASHBOARD_URL;
            } catch (err) {
                showToast(err.message || "Erreur lors de l'inscription.");
                setLoading(submitBtn, false);
            }
        });
    }

    /* ---------- CONNEXION ---------- */
    function initLoginForm() {
        const form = document.getElementById("loginForm");
        if (!form) return;

        setupPasswordToggle("togglePassword", "password");

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById("loginBtn");

            const email = document.getElementById("email").value.trim();
            const password = document.getElementById("password").value;

            setLoading(submitBtn, true);
            try {
                const { token, user } = await API.auth.login({ email, password });
                setSession(token, user);
                showToast("Connexion réussie !", "success");
                window.location.href = DASHBOARD_URL;
            } catch (err) {
                showToast(err.message || "Identifiants invalides.");
                setLoading(submitBtn, false);
            }
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        if (isAuthenticated() && (document.getElementById("loginForm") || document.getElementById("registerForm"))) {
            window.location.href = DASHBOARD_URL; // déjà connecté
            return;
        }
        initRegisterForm();
        initLoginForm();
    });
})();
