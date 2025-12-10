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

        // Charger aussi les comptes Instagram ajoutés manuellement
        const igResponse = await fetch('/api/instagram/accounts', {
            credentials: 'include'
        });

        if (igResponse.ok) {
            const igData = await igResponse.json();
            currentUser.instagramAccounts = igData.accounts || [];
        } else {
            currentUser.instagramAccounts = [];
        }

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

    const hasPages = currentUser.pages && currentUser.pages.length > 0;
    const hasInstagramAccounts = currentUser.instagramAccounts && currentUser.instagramAccounts.length > 0;

    if (!hasPages && !hasInstagramAccounts) {
        pagesList.innerHTML = `
            <p>Aucune page ou compte Instagram disponible.</p>
            <div class="info-box" style="margin-top: 15px;">
                <strong>💡 Deux options pour ajouter un compte:</strong><br>
                <strong>Option 1 - Via Facebook:</strong> Connectez une Page Facebook avec Instagram Business lié<br>
                <strong>Option 2 - Direct Instagram:</strong> Ajoutez votre compte Instagram manuellement via un token d'accès sur la <a href="/debug" style="color: #667eea;">page de debug</a>
            </div>
        `;
        return;
    }

    pagesList.innerHTML = '';

    // Afficher les Pages Facebook
    if (hasPages) {
        const fbHeader = document.createElement('h4');
        fbHeader.style.marginBottom = '15px';
        fbHeader.style.color = '#1877f2';
        fbHeader.innerHTML = '📘 Pages Facebook';
        pagesList.appendChild(fbHeader);

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

            pageCard.addEventListener('click', () => selectPage({ ...page, type: 'facebook' }));
            pagesList.appendChild(pageCard);
        });

        // Charger le statut de chaque page
        currentUser.pages.forEach(page => {
            loadPageConfig(page.id);
        });
    }

    // Afficher les comptes Instagram ajoutés manuellement
    if (hasInstagramAccounts) {
        const igHeader = document.createElement('h4');
        igHeader.style.marginTop = hasPages ? '30px' : '0';
        igHeader.style.marginBottom = '15px';
        igHeader.style.color = '#E4405F';
        igHeader.innerHTML = '📷 Comptes Instagram (ajoutés manuellement)';
        pagesList.appendChild(igHeader);

        currentUser.instagramAccounts.forEach(igAccount => {
            const pageCard = document.createElement('div');
            pageCard.className = 'page-card';
            pageCard.style.borderColor = '#E4405F';

            // Utiliser le préfixe 'ig_' pour différencier les comptes Instagram
            const pageId = `ig_${igAccount.instagram_id}`;

            pageCard.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>📷 @${igAccount.username}</strong>
                        <br>
                        <small style="color: #666;">${igAccount.name || igAccount.username}</small>
                        <br>
                        <small style="color: #999;">Instagram ID: ${igAccount.instagram_id}</small>
                    </div>
                    <div id="page-status-${pageId}">
                        <span class="status-badge inactive">Non configuré</span>
                    </div>
                </div>
            `;

            pageCard.addEventListener('click', () => selectPage({
                id: pageId,
                name: `@${igAccount.username}`,
                instagram_id: igAccount.instagram_id,
                username: igAccount.username,
                type: 'instagram'
            }));
            pagesList.appendChild(pageCard);

            // Charger le statut du compte Instagram
            loadPageConfig(pageId);
        });
    }
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
        alert('Veuillez sélectionner une page ou un compte Instagram');
        return;
    }

    const prompt = document.getElementById('prompt').value.trim();

    // Le prompt n'est plus obligatoire, un prompt par défaut sera utilisé s'il est vide

    const config = {
        page_id: selectedPageId,
        is_active: document.getElementById('is-active').checked,
        prompt: prompt, // Peut être vide, le backend utilisera le prompt par défaut
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

function showDefaultPrompt() {
    const defaultPrompt = `Tu es un assistant IA professionnel et motivant qui répond aux commentaires sur les réseaux sociaux.

Ton rôle est de:
✅ Accueillir chaleureusement les personnes qui commentent
✅ Répondre de manière pertinente et personnalisée à leur commentaire
✅ Être motivant et enthousiaste dans tes réponses
✅ Inciter subtilement les gens à s'intéresser à la solution ou au produit proposé
✅ Créer de l'engagement et encourager la discussion
✅ Montrer de l'empathie et de la compréhension

Principes clés:
- Sois authentique et humain dans tes interactions
- Adapte ton langage au contexte du commentaire
- Valorise les questions et remarques positives
- Réponds avec tact aux commentaires critiques
- Crée un sentiment de communauté et d'appartenance
- Encourage les gens à en savoir plus sans être insistant`;

    document.getElementById('prompt').value = defaultPrompt;

    // Scroll vers le textarea pour que l'utilisateur voie le prompt
    document.getElementById('prompt').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
