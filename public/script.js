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
    const loginArea = document.getElementById('login-area');
    const functionButtonsArea = document.getElementById('function-buttons-area');
    const connectionStatus = document.getElementById('connection-status');

    if (loginArea) loginArea.style.display = 'block';
    if (functionButtonsArea) functionButtonsArea.style.display = 'none';
    if (connectionStatus) connectionStatus.innerHTML = '';
}

/**
 * Afficher la section utilisateur connecté
 */
function showUserSection(userName) {
    const loginArea = document.getElementById('login-area');
    const functionButtonsArea = document.getElementById('function-buttons-area');
    const connectionStatus = document.getElementById('connection-status');

    if (loginArea) loginArea.style.display = 'none';
    if (functionButtonsArea) functionButtonsArea.style.display = 'block';

    if (connectionStatus) {
        connectionStatus.innerHTML = `
            <div class="card" style="background: rgba(76, 175, 80, 0.1); border-color: var(--success-green);">
                <p style="color: var(--success-green); font-weight: 600;">✅ Connecté : ${userName}</p>
            </div>
        `;
    }

    // Charger les données utilisateur
    loadUserData();
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

/**
 * Charger les données utilisateur
 */
async function loadUserData() {
    try {
        const response = await fetch('/api/user', {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Erreur lors du chargement des données');
        }

        const data = await response.json();

        if (data.authenticated && data.user) {
            // Remplir la section détails du compte
            const userDetailsContent = document.getElementById('user-details-content');
            if (userDetailsContent) {
                userDetailsContent.innerHTML = `
                    <div style="margin-bottom: 20px;">
                        <p style="color: var(--text-secondary); margin-bottom: 10px;">Nom :</p>
                        <p style="color: var(--text-primary); font-weight: 600; font-size: 1.1rem;">${data.user.name}</p>
                    </div>
                    <div style="margin-bottom: 20px;">
                        <p style="color: var(--text-secondary); margin-bottom: 10px;">ID utilisateur :</p>
                        <p style="color: var(--text-primary); font-family: monospace;">${data.user.id}</p>
                    </div>
                `;
            }

            // Charger les comptes disponibles pour la publication
            loadAccountsForPublisher();
        }
    } catch (error) {
        console.error('Erreur lors du chargement des données utilisateur:', error);
    }
}

/**
 * Charger les comptes pour le formulaire de publication
 */
async function loadAccountsForPublisher() {
    try {
        const response = await fetch('/api/accounts', {
            credentials: 'include'
        });

        if (!response.ok) return;

        const data = await response.json();
        const accountSelect = document.getElementById('account');

        if (accountSelect && data.accounts) {
            accountSelect.innerHTML = '<option value="">Sélectionnez un compte...</option>';
            data.accounts.forEach(account => {
                const option = document.createElement('option');
                option.value = account.id;
                option.textContent = `${account.name} (${account.platform})`;
                accountSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Erreur lors du chargement des comptes:', error);
    }
}
