// État global
let currentUser = null;
let uploadedFile = null;

// Charger les données au démarrage
document.addEventListener('DOMContentLoaded', () => {
  loadUserData();
  loadScheduledContent();
  setupEventListeners();
});

/**
 * Configuration des event listeners
 */
function setupEventListeners() {
  // Upload de fichier
  const uploadZone = document.getElementById('uploadZone');
  const fileInput = document.getElementById('fileInput');

  uploadZone.addEventListener('click', () => fileInput.click());

  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.style.borderColor = '#667eea';
    uploadZone.style.background = '#f8f9ff';
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.style.borderColor = '#e0e0e0';
    uploadZone.style.background = '';
  });

  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.style.borderColor = '#e0e0e0';
    uploadZone.style.background = '';

    if (e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  });

  // Changement de mode de publication
  document.getElementById('publishMode').addEventListener('change', (e) => {
    const scheduleTimeGroup = document.getElementById('scheduleTimeGroup');
    const submitText = document.getElementById('submitText');

    if (e.target.value === 'schedule') {
      scheduleTimeGroup.style.display = 'block';
      submitText.textContent = 'Programmer';
    } else {
      scheduleTimeGroup.style.display = 'none';
      submitText.textContent = 'Publier';
    }
  });

  // Soumission du formulaire
  document.getElementById('publishForm').addEventListener('submit', handleFormSubmit);
}

/**
 * Charger les données utilisateur
 */
async function loadUserData() {
  try {
    // Récupérer l'utilisateur courant
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

    // Peupler la liste des comptes
    populateAccountsList();

  } catch (error) {
    console.error('Erreur lors du chargement des données:', error);
    showAlert('Erreur lors du chargement des données', 'error');
  }
}

/**
 * Peupler la liste des comptes
 */
function populateAccountsList() {
  const accountSelect = document.getElementById('account');
  accountSelect.innerHTML = '<option value="">Sélectionnez un compte...</option>';

  // Ajouter les pages Facebook
  if (currentUser.pages && currentUser.pages.length > 0) {
    const fbGroup = document.createElement('optgroup');
    fbGroup.label = 'Pages Facebook';

    currentUser.pages.forEach(page => {
      const option = document.createElement('option');
      option.value = `facebook:${page.id}`;
      option.textContent = page.name;
      fbGroup.appendChild(option);
    });

    accountSelect.appendChild(fbGroup);
  }

  // Ajouter les comptes Instagram
  if (currentUser.instagramAccounts && currentUser.instagramAccounts.length > 0) {
    const igGroup = document.createElement('optgroup');
    igGroup.label = 'Comptes Instagram';

    currentUser.instagramAccounts.forEach(account => {
      const option = document.createElement('option');
      option.value = `instagram:ig_${account.instagram_id}`;
      option.textContent = `@${account.username}`;
      igGroup.appendChild(option);
    });

    accountSelect.appendChild(igGroup);
  }
}

/**
 * Upload de fichier
 */
async function handleFileUpload(file) {
  // Validation du type de fichier
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'video/mp4', 'video/quicktime', 'video/mpeg'];
  if (!allowedTypes.includes(file.type)) {
    showAlert('Type de fichier non autorisé. Utilisez JPG, PNG ou MP4', 'error');
    return;
  }

  // Validation de la taille (100MB max)
  if (file.size > 100 * 1024 * 1024) {
    showAlert('Le fichier est trop volumineux (max 100MB)', 'error');
    return;
  }

  // Afficher la prévisualisation immédiatement
  const preview = document.getElementById('uploadPreview');
  const reader = new FileReader();

  reader.onload = (e) => {
    if (file.type.startsWith('image/')) {
      preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
    } else if (file.type.startsWith('video/')) {
      preview.innerHTML = `<video src="${e.target.result}" controls></video>`;
    }
  };

  reader.readAsDataURL(file);

  // Upload vers le serveur
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      credentials: 'include',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Erreur lors de l\'upload');
    }

    const data = await response.json();
    uploadedFile = data.file;

    showAlert(`Fichier uploadé avec succès: ${uploadedFile.filename}`, 'success');

  } catch (error) {
    console.error('Erreur upload:', error);
    showAlert('Erreur lors de l\'upload du fichier', 'error');
    preview.innerHTML = '';
  }
}

/**
 * Soumission du formulaire
 */
async function handleFormSubmit(e) {
  e.preventDefault();

  const accountValue = document.getElementById('account').value;
  const contentType = document.getElementById('contentType').value;
  const caption = document.getElementById('caption').value;
  const publishMode = document.getElementById('publishMode').value;

  if (!accountValue) {
    showAlert('Veuillez sélectionner un compte', 'error');
    return;
  }

  if (!contentType) {
    showAlert('Veuillez sélectionner un type de contenu', 'error');
    return;
  }

  // Vérifier que le type de contenu correspond au type de fichier
  if (contentType === 'reel' && (!uploadedFile || uploadedFile.media_type !== 'video')) {
    showAlert('Les reels nécessitent une vidéo', 'error');
    return;
  }

  // Parser le compte
  const [accountType, accountId] = accountValue.split(':');

  // Préparer les données
  const contentData = {
    account_id: accountId,
    account_type: accountType,
    content_type: contentType,
    caption: caption || null,
    media_url: uploadedFile ? uploadedFile.url : null,
    media_type: uploadedFile ? uploadedFile.media_type : null
  };

  try {
    const form = document.getElementById('publishForm');
    form.classList.add('loading');

    let response;

    if (publishMode === 'now') {
      // Publier immédiatement
      response = await fetch('/api/content/publish-now', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(contentData)
      });

    } else {
      // Programmer
      const scheduleTime = document.getElementById('scheduleTime').value;
      if (!scheduleTime) {
        showAlert('Veuillez sélectionner une date et heure', 'error');
        form.classList.remove('loading');
        return;
      }

      contentData.scheduled_time = new Date(scheduleTime).toISOString();

      response = await fetch('/api/content/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(contentData)
      });
    }

    form.classList.remove('loading');

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erreur lors de la publication');
    }

    const data = await response.json();

    if (publishMode === 'now') {
      showAlert('✅ Contenu publié avec succès!', 'success');
    } else {
      showAlert('✅ Contenu programmé avec succès!', 'success');
      loadScheduledContent();
    }

    resetForm();

  } catch (error) {
    console.error('Erreur:', error);
    showAlert(error.message, 'error');
    document.getElementById('publishForm').classList.remove('loading');
  }
}

/**
 * Charger le contenu programmé
 */
async function loadScheduledContent() {
  try {
    const response = await fetch('/api/content/scheduled', {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Erreur lors du chargement');
    }

    const data = await response.json();
    const scheduledList = document.getElementById('scheduledList');

    if (!data.content || data.content.length === 0) {
      scheduledList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📅</div>
          <div>Aucun contenu programmé</div>
        </div>
      `;
      return;
    }

    scheduledList.innerHTML = data.content.map(item => {
      const scheduledDate = new Date(item.scheduled_time);
      const formattedDate = scheduledDate.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      return `
        <div class="scheduled-item">
          <div class="scheduled-item-header">
            <span class="scheduled-item-type">${item.content_type} - ${item.account_type}</span>
            <span class="status ${item.status}">${getStatusText(item.status)}</span>
          </div>
          <div class="scheduled-item-time">📅 ${formattedDate}</div>
          ${item.caption ? `<div class="scheduled-item-caption">${escapeHtml(item.caption)}</div>` : ''}
          ${item.status === 'pending' ? `
            <button class="delete-btn" onclick="deleteScheduledContent(${item.id})">
              Supprimer
            </button>
          ` : ''}
          ${item.status === 'failed' && item.error_message ? `
            <div style="color: #721c24; font-size: 0.85rem; margin-top: 8px;">
              ❌ ${escapeHtml(item.error_message)}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

  } catch (error) {
    console.error('Erreur lors du chargement du contenu programmé:', error);
  }
}

/**
 * Supprimer un contenu programmé
 */
async function deleteScheduledContent(contentId) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce contenu programmé ?')) {
    return;
  }

  try {
    const response = await fetch(`/api/content/scheduled/${contentId}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la suppression');
    }

    showAlert('Contenu supprimé avec succès', 'success');
    loadScheduledContent();

  } catch (error) {
    console.error('Erreur:', error);
    showAlert('Erreur lors de la suppression', 'error');
  }
}

/**
 * Réinitialiser le formulaire
 */
function resetForm() {
  document.getElementById('publishForm').reset();
  document.getElementById('uploadPreview').innerHTML = '';
  document.getElementById('scheduleTimeGroup').style.display = 'none';
  document.getElementById('submitText').textContent = 'Publier';
  uploadedFile = null;
}

/**
 * Afficher une alerte
 */
function showAlert(message, type) {
  const alertContainer = document.getElementById('alertContainer');
  const alertClass = type === 'success' ? 'alert-success' : 'alert-error';

  const alert = document.createElement('div');
  alert.className = `alert ${alertClass}`;
  alert.textContent = message;

  alertContainer.appendChild(alert);

  setTimeout(() => {
    alert.remove();
  }, 5000);
}

/**
 * Obtenir le texte du statut
 */
function getStatusText(status) {
  const statusMap = {
    pending: 'En attente',
    publishing: 'Publication...',
    published: 'Publié',
    failed: 'Échec'
  };
  return statusMap[status] || status;
}

/**
 * Échapper le HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Actualiser la liste toutes les 30 secondes
setInterval(loadScheduledContent, 30000);
