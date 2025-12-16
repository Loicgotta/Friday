// État global
let currentUser = null;
let currentPage = 0;
let itemsPerPage = 20;
let currentPlatform = '';
let currentAccount = '';
let totalComments = 0;

// Charger les données au démarrage
document.addEventListener('DOMContentLoaded', () => {
  loadUserData();
  loadStats();
  loadComments();
});

/**
 * Charger les données utilisateur et peupler les filtres
 */
async function loadUserData() {
  try {
    const response = await fetch('/api/user', {
      credentials: 'include'
    });

    if (!response.ok) {
      window.location.href = '/';
      return;
    }

    currentUser = await response.json();

    // Charger les comptes Instagram
    const igResponse = await fetch('/api/instagram/accounts', {
      credentials: 'include'
    });

    if (igResponse.ok) {
      const igData = await igResponse.json();
      currentUser.instagramAccounts = igData.accounts || [];
    } else {
      currentUser.instagramAccounts = [];
    }

    // Peupler le filtre des comptes
    populateAccountFilter();

  } catch (error) {
    console.error('Erreur lors du chargement des données:', error);
  }
}

/**
 * Peupler le filtre des comptes
 */
function populateAccountFilter() {
  const accountFilter = document.getElementById('accountFilter');
  accountFilter.innerHTML = '<option value="">Tous les comptes</option>';

  // Ajouter les pages Facebook
  if (currentUser.pages && currentUser.pages.length > 0) {
    const fbGroup = document.createElement('optgroup');
    fbGroup.label = 'Pages Facebook';

    currentUser.pages.forEach(page => {
      const option = document.createElement('option');
      option.value = page.id;
      option.textContent = page.name;
      fbGroup.appendChild(option);
    });

    accountFilter.appendChild(fbGroup);
  }

  // Ajouter les comptes Instagram
  if (currentUser.instagramAccounts && currentUser.instagramAccounts.length > 0) {
    const igGroup = document.createElement('optgroup');
    igGroup.label = 'Comptes Instagram';

    currentUser.instagramAccounts.forEach(account => {
      const option = document.createElement('option');
      option.value = `ig_${account.instagram_id}`;
      option.textContent = `@${account.username}`;
      igGroup.appendChild(option);
    });

    accountFilter.appendChild(igGroup);
  }
}

/**
 * Charger les statistiques
 */
async function loadStats() {
  try {
    const response = await fetch('/api/comments/stats', {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Erreur lors du chargement des statistiques');
    }

    const stats = await response.json();

    document.getElementById('totalStat').textContent = stats.total || 0;
    document.getElementById('instagramStat').textContent = stats.instagram || 0;
    document.getElementById('facebookStat').textContent = stats.facebook || 0;
    document.getElementById('last24hStat').textContent = stats.last24h || 0;

  } catch (error) {
    console.error('Erreur:', error);
  }
}

/**
 * Charger les commentaires
 */
async function loadComments() {
  try {
    const commentsList = document.getElementById('commentsList');
    commentsList.innerHTML = `
      <div class="loading">
        <div class="loading-spinner"></div>
        <div>Chargement des commentaires...</div>
      </div>
    `;

    const params = new URLSearchParams({
      limit: itemsPerPage,
      offset: currentPage * itemsPerPage
    });

    if (currentPlatform) {
      params.append('platform', currentPlatform);
    }

    if (currentAccount) {
      params.append('page_id', currentAccount);
    }

    const response = await fetch(`/api/comments/history?${params}`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Erreur lors du chargement des commentaires');
    }

    const data = await response.json();
    totalComments = data.total;

    if (data.comments.length === 0) {
      commentsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">💬</div>
          <div class="empty-state-text">Aucun commentaire traité</div>
          <div class="empty-state-hint">
            ${currentPlatform || currentAccount ? 'Essayez de changer les filtres' : 'Les commentaires traités apparaîtront ici'}
          </div>
        </div>
      `;
      document.getElementById('pagination').style.display = 'none';
      return;
    }

    // Afficher les commentaires
    commentsList.innerHTML = data.comments.map(comment => renderComment(comment)).join('');

    // Afficher la pagination
    updatePagination(data.total);

  } catch (error) {
    console.error('Erreur:', error);
    document.getElementById('commentsList').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">❌</div>
        <div class="empty-state-text">Erreur lors du chargement</div>
        <div class="empty-state-hint">${error.message}</div>
      </div>
    `;
  }
}

/**
 * Rendre un commentaire en HTML
 */
function renderComment(comment) {
  const isInstagram = comment.page_id.startsWith('ig_');
  const platform = isInstagram ? 'instagram' : 'facebook';
  const platformName = isInstagram ? 'Instagram' : 'Facebook';

  // Formater la date
  const date = new Date(comment.replied_at);
  const formattedDate = date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Trouver le nom du compte
  let accountName = comment.page_id;
  if (isInstagram && currentUser.instagramAccounts) {
    const account = currentUser.instagramAccounts.find(a => `ig_${a.instagram_id}` === comment.page_id);
    if (account) accountName = `@${account.username}`;
  } else if (!isInstagram && currentUser.pages) {
    const page = currentUser.pages.find(p => p.id === comment.page_id);
    if (page) accountName = page.name;
  }

  return `
    <div class="comment-item">
      <div class="comment-header">
        <div class="comment-meta">
          <span class="platform-badge ${platform}">${platformName}</span>
          <span class="comment-date">📅 ${formattedDate}</span>
        </div>
        <div class="comment-id">ID: ${comment.comment_id}</div>
      </div>

      <div style="margin-bottom: 10px;">
        <strong>Compte:</strong> ${escapeHtml(accountName)}
      </div>

      <div class="comment-content">
        <div class="comment-label">💬 Commentaire reçu:</div>
        <div class="comment-text">(Texte original non stocké)</div>
      </div>

      <div class="reply-content">
        <div class="comment-label">🤖 Réponse de Friday:</div>
        <div class="comment-text">${escapeHtml(comment.reply_text || 'Aucune réponse')}</div>
      </div>
    </div>
  `;
}

/**
 * Mettre à jour la pagination
 */
function updatePagination(total) {
  const pagination = document.getElementById('pagination');
  const paginationInfo = document.getElementById('paginationInfo');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  pagination.style.display = 'flex';

  const start = currentPage * itemsPerPage + 1;
  const end = Math.min((currentPage + 1) * itemsPerPage, total);
  paginationInfo.textContent = `${start}-${end} sur ${total}`;

  prevBtn.disabled = currentPage === 0;
  nextBtn.disabled = (currentPage + 1) * itemsPerPage >= total;
}

/**
 * Page précédente
 */
function previousPage() {
  if (currentPage > 0) {
    currentPage--;
    loadComments();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/**
 * Page suivante
 */
function nextPage() {
  if ((currentPage + 1) * itemsPerPage < totalComments) {
    currentPage++;
    loadComments();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/**
 * Appliquer les filtres
 */
function applyFilters() {
  currentPlatform = document.getElementById('platformFilter').value;
  currentAccount = document.getElementById('accountFilter').value;
  currentPage = 0; // Reset à la première page
  loadComments();
}

/**
 * Échapper le HTML
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Actualiser les stats toutes les 30 secondes
setInterval(loadStats, 30000);

// Actualiser les commentaires toutes les 60 secondes
setInterval(loadComments, 60000);
