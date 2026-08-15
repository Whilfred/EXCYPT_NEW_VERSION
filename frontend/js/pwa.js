// js/pwa.js
// Gère l'installation de l'app (PWA) et l'enregistrement du service worker.
// Fonctionne sur toutes les pages, qu'elles aient ou non un bouton #installApp.

(() => {
  let deferredPrompt = null;

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

  // Utilise le bouton existant s'il y en a un sur la page (ex: index.html),
  // sinon en crée un flottant automatiquement.
  function getOrCreateInstallButton() {
    let btn = document.getElementById('installApp');
    if (btn) return btn;

    btn = document.createElement('button');
    btn.id = 'installApp';
    btn.type = 'button';
    btn.textContent = "Installer l'application";
    btn.hidden = true;
    Object.assign(btn.style, {
      position: 'fixed',
      right: '18px',
      bottom: '18px',
      zIndex: '9999',
      padding: '12px 18px',
      borderRadius: '999px',
      border: 'none',
      background: '#16845b',
      color: '#fff',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '14px',
      fontWeight: '700',
      cursor: 'pointer',
      boxShadow: '0 10px 24px rgba(0,0,0,0.22)',
    });
    btn.addEventListener('mouseenter', () => (btn.style.background = '#0f6848'));
    btn.addEventListener('mouseleave', () => (btn.style.background = '#16845b'));
    document.body.appendChild(btn);
    return btn;
  }

  const installButton = getOrCreateInstallButton();
  if (isStandalone) installButton.hidden = true;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    if (!isStandalone) installButton.hidden = false;
  });

  installButton.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      installButton.hidden = true;
      return;
    }

    // iOS Safari ne supporte pas beforeinstallprompt : on guide l'utilisateur.
    if (isIos && !isStandalone) {
      alert(
        "Pour installer ExCrypt : appuie sur le bouton Partager de Safari, " +
        "puis choisis « Sur l'écran d'accueil »."
      );
    }
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installButton.hidden = true;
  });

  // Sur iOS, l'API d'installation n'existe pas : on affiche quand même le
  // bouton (hors mode standalone) pour donner l'instruction au clic.
  if (isIos && !isStandalone) {
    installButton.hidden = false;
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).catch(() => {});
    });
  }
})();
