// js/auth-guard.js — bloque l'accès au dashboard sans session valide
(function () {
    const token = localStorage.getItem("excrypt_token");
    if (!token) {
        window.location.href = "pages/login.html";
    }
})();
