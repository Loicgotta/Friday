let currentUser = null;
let selectedPageId = null;

// Vérifier l'authentification au chargement
window.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
});

async function checkAuth() {
    try {
        const response = await fetch('/api/status', {
            credentials: 'include'
        });

        const data = await response.json();

        if (!data.authenticated) {
            document.getElementById('not-logged-in').style.display = 'block';
            document.getElementById('config-content').style.display = 'none';
            return;
        }

        // Charger les données utilisateur
        await loadUserData();

    } catch (error) {
        console.error('Erreur:', error);
        document.getElementById('not-logged-in').style.display = 'block';
    }
}

async function loadUserData() {
    try {
        const response = await fetch('/api/user', {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Erreur lors du chargement des données');
        }

        currentUser = await response.json();

        // Afficher le contenu
        document.getElementById('config-content').style.display = 'block';

        // Charger les pages
        loadPages();

        // Charger les statistiques
        loadStats();

    } catch (error) {
        console.error('Erreur:', error);
        document.getElementById('not-logged-in').style.display = 'block';
    }
}

function loadPages() {
    const pagesList = document.getElementById('pages-list');

    if (!currentUser.pages || currentUser.pages.length === 0) {
        pagesList.innerHTML = `
            <p>Aucune page disponible. Assurez-vous d'avoir des pages Facebook connectées.</p>
            <div class="info-box" style="margin-top: 15px;">
                <strong>💡 Pour utiliser Instagram:</strong><br>
                1. Votre compte Instagram doit être un compte Business<br>
                2. Il doit être lié à une Page Facebook<br>
                3. Connectez-vous avec Facebook Login (Instagram est inclus automatiquement)
            </div>
        `;
        return;
    }

    pagesList.innerHTML = '';

    currentUser.pages.forEach(page => {
        const pageCard = document.createElement('div');
        pageCard.className = 'page-card';

        // Vérifier si Instagram est connecté
        const hasInstagram = page.instagram_account;
        const instagramInfo = hasInstagram
            ? `<br><small style="color: #E4405F;">📷 Instagram: @${page.instagram_account.username}</small>`
            : `<br><small style="color: #999;">📷 Instagram: Non connecté</small>`;

        pageCard.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>📘 ${page.name}</strong>
                    <br>
                    <small style="color: #666;">Facebook ID: ${page.id}</small>
                    ${instagramInfo}
                </div>
                <div id="page-status-${page.id}">
                    <span class="status-badge inactive">Non configuré</span>
                </div>
            </div>
        `;

        pageCard.addEventListener('click', () => selectPage(page));
        pagesList.appendChild(pageCard);
    });

    // Charger le statut de chaque page
    currentUser.pages.forEach(page => {
        loadPageConfig(page.id);
    });
}

async function loadPageConfig(pageId) {
    try {
        const response = await fetch(`/api/agent/config/${pageId}`, {
            credentials: 'include'
        });

        if (response.ok) {
            const config = await response.json();
            const statusBadge = document.getElementById(`page-status-${pageId}`);

            if (config && config.is_active) {
                statusBadge.innerHTML = '<span class="status-badge active">🟢 Actif</span>';
            } else if (config) {
                statusBadge.innerHTML = '<span class="status-badge inactive">⏸️ Configuré</span>';
            }
        }
    } catch (error) {
        console.error('Erreur:', error);
    }
}

async function selectPage(page) {
    selectedPageId = page.id;

    // Marquer visuellement la page sélectionnée
    document.querySelectorAll('.page-card').forEach(card => {
        card.classList.remove('selected');
    });

    event.currentTarget.classList.add('selected');

    // Afficher le formulaire
    document.getElementById('config-form-container').style.display = 'block';

    // Charger la configuration existante
    await loadConfigForPage(page.id);
}

async function loadConfigForPage(pageId) {
    try {
        const response = await fetch(`/api/agent/config/${pageId}`, {
            credentials: 'include'
        });

        if (response.ok) {
            const config = await response.json();

            if (config) {
                // Remplir le formulaire avec la config existante
                document.getElementById('is-active').checked = config.is_active === 1;
                document.getElementById('prompt').value = config.prompt || '';
                document.getElementById('tone').value = config.tone || 'friendly';
                document.getElementById('language').value = config.language || 'fr';
                document.getElementById('auto-reply').checked = config.auto_reply_enabled === 1;
                document.getElementById('delay').value = config.reply_delay_minutes || 0;

                updateAgentStatus(config.is_active === 1);
            } else {
                // Valeurs par défaut
                resetForm();
            }
        } else {
            resetForm();
        }
    } catch (error) {
        console.error('Erreur:', error);
        resetForm();
    }
}

function resetForm() {
    document.getElementById('is-active').checked = false;
    document.getElementById('prompt').value = '';
    document.getElementById('tone').value = 'friendly';
    document.getElementById('language').value = 'fr';
    document.getElementById('auto-reply').checked = true;
    document.getElementById('delay').value = 0;
    updateAgentStatus(false);
}

function updateAgentStatus(isActive) {
    const statusBadge = document.getElementById('agent-status');
    if (isActive) {
        statusBadge.textContent = 'Actif';
        statusBadge.className = 'status-badge active';
    } else {
        statusBadge.textContent = 'Inactif';
        statusBadge.className = 'status-badge inactive';
    }
}

// Mettre à jour le statut en temps réel quand on change le toggle
document.addEventListener('DOMContentLoaded', () => {
    const isActiveToggle = document.getElementById('is-active');
    if (isActiveToggle) {
        isActiveToggle.addEventListener('change', (e) => {
            updateAgentStatus(e.target.checked);
        });
    }
});

async function saveConfig() {
    if (!selectedPageId) {
        alert('Veuillez sélectionner une page');
        return;
    }

    const prompt = document.getElementById('prompt').value.trim();

    if (!prompt) {
        alert('Veuillez entrer un prompt pour l\'agent');
        return;
    }

    const config = {
        page_id: selectedPageId,
        is_active: document.getElementById('is-active').checked,
        prompt: prompt,
        tone: document.getElementById('tone').value,
        language: document.getElementById('language').value,
        auto_reply_enabled: document.getElementById('auto-reply').checked,
        reply_delay_minutes: parseInt(document.getElementById('delay').value) || 0
    };

    try {
        const response = await fetch('/api/agent/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(config)
        });

        if (response.ok) {
            alert('✅ Configuration sauvegardée avec succès!');

            // Recharger le statut de la page
            await loadPageConfig(selectedPageId);

            // Recharger les stats
            await loadStats();
        } else {
            const error = await response.json();
            alert(`❌ Erreur: ${error.error || 'Erreur inconnue'}`);
        }
    } catch (error) {
        console.error('Erreur:', error);
        alert('❌ Erreur lors de la sauvegarde');
    }
}

async function loadStats() {
    try {
        const response = await fetch('/api/agent/stats', {
            credentials: 'include'
        });

        if (response.ok) {
            const stats = await response.json();

            document.getElementById('stat-responses').textContent = stats.total_responses || 0;
            document.getElementById('stat-pages').textContent = stats.total_pages || 0;
            document.getElementById('stat-active').textContent = stats.active_agents || 0;
        }
    } catch (error) {
        console.error('Erreur lors du chargement des stats:', error);
    }
}
