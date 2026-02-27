// Vérifier si l'utilisateur est déjà connecté au chargement de la page
window.addEventListener('DOMContentLoaded', async () => {
    // Vérifier s'il y a un message d'erreur ou de succès dans l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const success = urlParams.get('success');

    if (error) {
        showError(decodeURIComponent(error));
    }

    if (success) {
        showSuccess(decodeURIComponent(success));
    }

    // Nettoyer l'URL
    if (error || success) {
        window.history.replaceState({}, document.title, window.location.pathname);
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
 * Afficher un message de succès
 */
function showSuccess(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.innerHTML = `
        <div style="background: rgba(76, 175, 80, 0.1); border: 1px solid #4CAF50; border-radius: 8px; padding: 20px; margin-bottom: 20px; animation: slideDown 0.3s ease-out;">
            <h3 style="color: #4CAF50; margin-bottom: 10px; font-size: 1.1rem;">✅ ${message}</h3>
            <p style="color: var(--text-secondary); margin-bottom: 0; line-height: 1.6;">
                Vous pouvez maintenant utiliser toutes les fonctionnalités de Friday.
            </p>
        </div>
    `;
    errorDiv.style.display = 'block';

    // Masquer le message après 8 secondes
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 8000);
}

/**
 * Afficher un message d'erreur
 */
function showError(message) {
    const errorDiv = document.getElementById('error-message');

    // Traduire les erreurs courantes en messages plus clairs
    let friendlyMessage = message;
    let helpText = '';

    if (message.includes('access_denied') || message.includes('utilisateur a refusé')) {
        friendlyMessage = 'Connexion annulée';
        helpText = 'Vous devez autoriser les permissions pour utiliser Friday.';
    } else if (message.includes('pages') || message.includes('page') || message.includes('Page')) {
        friendlyMessage = 'Aucune Page Facebook trouvée';
        helpText = 'Assurez-vous d\'être administrateur d\'une Page Facebook liée à votre compte Instagram Business.';
    } else if (message.includes('instagram') || message.includes('Instagram')) {
        friendlyMessage = 'Problème avec le compte Instagram';
        helpText = 'Vérifiez que votre compte est un compte Business ou Creator, et qu\'il est bien lié à une Page Facebook.';
    } else if (message.includes('permissions')) {
        friendlyMessage = 'Permissions manquantes';
        helpText = 'Certaines permissions n\'ont pas été accordées. Réessayez et acceptez toutes les permissions.';
    }

    errorDiv.innerHTML = `
        <div style="background: rgba(244, 67, 54, 0.1); border: 1px solid #f44336; border-radius: 8px; padding: 20px; margin-bottom: 20px; animation: slideDown 0.3s ease-out;">
            <h3 style="color: #f44336; margin-bottom: 10px; font-size: 1.1rem;">❌ ${friendlyMessage}</h3>
            ${helpText ? `<p style="color: var(--text-secondary); margin-bottom: 15px; line-height: 1.6;">${helpText}</p>` : ''}
            <details style="color: var(--text-secondary); font-size: 0.9rem;">
                <summary style="cursor: pointer; margin-bottom: 10px; color: var(--text-primary);">Détails techniques</summary>
                <code style="background: var(--bg-darker); padding: 10px; border-radius: 4px; display: block; overflow-x: auto;">${message}</code>
            </details>
            <button onclick="this.parentElement.parentElement.style.display='none'"
                    style="margin-top: 15px; background: transparent; border: 1px solid #f44336; color: #f44336; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 500;">
                Fermer
            </button>
        </div>
    `;
    errorDiv.style.display = 'block';

    // Masquer l'erreur après 15 secondes (plus long pour laisser le temps de lire)
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 15000);
}

// Ajouter l'animation slideDown
const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateY(-20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(style);

/**
 * Bouton de connexion Facebook
 */
const facebookLoginBtn = document.getElementById('facebook-login-btn');
if (facebookLoginBtn) {
    facebookLoginBtn.addEventListener('click', () => {
        // Afficher l'état de chargement
        const btnContent = document.getElementById('login-btn-content');
        const btnLoading = document.getElementById('login-btn-loading');

        if (btnContent) btnContent.style.display = 'none';
        if (btnLoading) btnLoading.style.display = 'flex';
        facebookLoginBtn.disabled = true;
        facebookLoginBtn.style.opacity = '0.8';
        facebookLoginBtn.style.cursor = 'wait';

        // Rediriger vers l'authentification Facebook
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
