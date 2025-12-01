// Vérifier si l'utilisateur est déjà connecté au chargement de la page
window.addEventListener('DOMContentLoaded', async () => {
    // Vérifier s'il y a un message d'erreur dans l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');

    if (error) {
        showError(decodeURIComponent(error));
    }

    // Vérifier le statut de connexion
    await checkAuthStatus();
});

/**
 * Vérifier si l'utilisateur est authentifié
 */
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/status', {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Erreur lors de la vérification du statut');
        }

        const data = await response.json();

        if (data.authenticated) {
            showUserSection(data.userName);
        } else {
            showLoginSection();
        }
    } catch (error) {
        console.error('Erreur lors de la vérification du statut:', error);
        showLoginSection();
    }
}

/**
 * Afficher la section de connexion
 */
function showLoginSection() {
    document.getElementById('login-section').style.display = 'block';
    document.getElementById('user-section').style.display = 'none';
}

/**
 * Afficher la section utilisateur connecté
 */
function showUserSection(userName) {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('user-section').style.display = 'block';
    document.getElementById('user-name').textContent = `Bonjour, ${userName}!`;
}

/**
 * Afficher un message d'erreur
 */
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = `❌ ${message}`;
    errorDiv.style.display = 'block';

    // Masquer l'erreur après 10 secondes
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 10000);
}

/**
 * Bouton de connexion Facebook
 */
const facebookLoginBtn = document.getElementById('facebook-login-btn');
if (facebookLoginBtn) {
    facebookLoginBtn.addEventListener('click', () => {
        window.location.href = '/auth/facebook';
    });
}

/**
 * Bouton voir les détails
 */
const viewDetailsBtn = document.getElementById('view-details-btn');
if (viewDetailsBtn) {
    viewDetailsBtn.addEventListener('click', () => {
        window.location.href = '/success.html';
    });
}

/**
 * Bouton de déconnexion
 */
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        if (!confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
            return;
        }

        try {
            window.location.href = '/auth/logout';
        } catch (error) {
            console.error('Erreur lors de la déconnexion:', error);
            showError('Erreur lors de la déconnexion');
        }
    });
}
