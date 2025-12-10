require('dotenv').config();
const express = require('express');
const session = require('express-session');
const axios = require('axios');
const cors = require('cors');
const Database = require('./database');
const CommentMonitor = require('./comment-monitor');

const app = express();
const db = new Database();
const commentMonitor = new CommentMonitor();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Mettre à true en production avec HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 heures
  }
}));

// Servir les fichiers statiques
app.use(express.static('public'));

// Permissions Facebook et Instagram requises pour l'agent IA
const FACEBOOK_PERMISSIONS = [
  // Permissions de base
  'public_profile',

  // Gestion des Pages
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',      // Pour répondre aux commentaires

  // Instagram Business
  'instagram_basic',
  'instagram_manage_comments'
].join(',');

// NOTE: Ces permissions peuvent nécessiter une App Review selon votre app
// En mode Development, elles fonctionnent pour les testeurs ajoutés

/**
 * Route 1: Initier le processus d'authentification Facebook
 */
app.get('/auth/facebook', (req, res) => {
  const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
    `client_id=${process.env.FACEBOOK_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(process.env.CALLBACK_URL)}` +
    `&scope=${encodeURIComponent(FACEBOOK_PERMISSIONS)}` +
    `&response_type=code` +
    `&state=${generateState()}`;

  res.redirect(authUrl);
});

/**
 * Route 2: Callback après authentification Facebook
 */
app.get('/auth/facebook/callback', async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    console.error('Erreur OAuth:', error, error_description);
    return res.redirect(`/?error=${encodeURIComponent(error_description || error)}`);
  }

  if (!code) {
    return res.redirect('/?error=Code d\'autorisation manquant');
  }

  try {
    // Échanger le code contre un access token
    // Note: L'endpoint oauth/access_token ne nécessite PAS de numéro de version
    const tokenResponse = await axios.get('https://graph.facebook.com/oauth/access_token', {
      params: {
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        redirect_uri: process.env.CALLBACK_URL,
        code: code
      }
    });

    const { access_token, expires_in } = tokenResponse.data;

    // Échanger le short-lived token contre un long-lived token
    const longLivedTokenResponse = await axios.get('https://graph.facebook.com/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        fb_exchange_token: access_token
      }
    });

    const longLivedToken = longLivedTokenResponse.data.access_token;
    const longLivedExpiresIn = longLivedTokenResponse.data.expires_in;

    // Récupérer les informations de l'utilisateur
    const userResponse = await axios.get('https://graph.facebook.com/v18.0/me', {
      params: {
        fields: 'id,name,email',
        access_token: longLivedToken
      }
    });

    const userData = userResponse.data;

    // 🐛 DEBUG: Vérifier les permissions accordées
    console.log('=== DEBUG USER ===');
    console.log(`User connecté: ${userData.name} (ID: ${userData.id})`);
    try {
      const permissionsResponse = await axios.get('https://graph.facebook.com/v18.0/me/permissions', {
        params: { access_token: longLivedToken }
      });
      console.log('Permissions accordées:');
      permissionsResponse.data.data.forEach(perm => {
        if (perm.status === 'granted') {
          console.log(`  ✅ ${perm.permission}`);
        } else {
          console.log(`  ❌ ${perm.permission} (${perm.status})`);
        }
      });
    } catch (err) {
      console.log('Erreur lors de la récupération des permissions:', err.message);
    }
    console.log('==================');

    // Récupérer les pages et comptes Instagram de l'utilisateur
    const accountsResponse = await axios.get('https://graph.facebook.com/v18.0/me/accounts', {
      params: {
        fields: 'id,name,access_token,instagram_business_account',
        access_token: longLivedToken
      }
    });

    const pages = accountsResponse.data.data || [];

    // 🐛 DEBUG: Log ce que l'API retourne
    console.log('=== DEBUG PAGES ===');
    console.log(`Nombre de pages trouvées: ${pages.length}`);

    if (pages.length === 0) {
      console.log('⚠️ AUCUNE PAGE TROUVÉE !');
      console.log('Raisons possibles:');
      console.log('  1. Le compte n\'a pas de Pages Facebook');
      console.log('  2. Le compte n\'est pas admin/éditeur des Pages');
      console.log('  3. Le compte n\'a pas le rôle Testeur/Développeur dans l\'app Facebook (mode Dev)');
      console.log('  4. Les permissions pages_show_list ne sont pas accordées');
    }

    pages.forEach(page => {
      console.log(`\nPage: ${page.name} (ID: ${page.id})`);
      console.log(`  - A instagram_business_account: ${!!page.instagram_business_account}`);
      if (page.instagram_business_account) {
        console.log(`  - Instagram ID: ${page.instagram_business_account.id}`);
      } else {
        console.log(`  ⚠️ Cette page n'a PAS de compte Instagram lié`);
      }
    });
    console.log('==================');

    // Pour chaque page, récupérer les détails du compte Instagram Business si connecté
    for (const page of pages) {
      if (page.instagram_business_account) {
        try {
          const igResponse = await axios.get(
            `https://graph.facebook.com/v18.0/${page.instagram_business_account.id}`,
            {
              params: {
                fields: 'id,username,name,profile_picture_url',
                access_token: page.access_token
              }
            }
          );
          page.instagram_account = igResponse.data;
          console.log(`✅ Instagram récupéré: @${igResponse.data.username}`);
        } catch (igError) {
          console.log(`⚠️ Erreur Instagram pour page ${page.name}:`, igError.response?.data || igError.message);
        }
      }
    }

    // Récupérer les comptes publicitaires (optionnel - nécessite ads_management)
    let adAccounts = [];
    try {
      const adAccountsResponse = await axios.get('https://graph.facebook.com/v18.0/me/adaccounts', {
        params: {
          fields: 'id,name,account_id,account_status',
          access_token: longLivedToken
        }
      });
      adAccounts = adAccountsResponse.data.data || [];
    } catch (adError) {
      // L'utilisateur n'a probablement pas la permission ads_management
      console.log('Info: Impossible de récupérer les comptes publicitaires (permission manquante)');
    }

    // Récupérer les permissions accordées
    const permissionsResponse = await axios.get('https://graph.facebook.com/v18.0/me/permissions', {
      params: {
        access_token: longLivedToken
      }
    });

    const permissions = permissionsResponse.data.data
      .filter(p => p.status === 'granted')
      .map(p => p.permission);

    // 🐛 DEBUG: Stocker les infos de debug dans la session pour affichage
    req.session.debugInfo = {
      user: {
        id: userData.id,
        name: userData.name,
        email: userData.email
      },
      permissions: permissionsResponse.data.data,
      pages: pages.map(p => ({
        id: p.id,
        name: p.name,
        hasInstagram: !!p.instagram_business_account,
        instagramId: p.instagram_business_account?.id,
        instagramUsername: p.instagram_account?.username
      })),
      timestamp: new Date().toISOString()
    };

    // Sauvegarder dans la base de données
    const expiresAt = new Date(Date.now() + longLivedExpiresIn * 1000);

    await db.saveUser({
      facebook_id: userData.id,
      name: userData.name,
      email: userData.email,
      access_token: longLivedToken,
      expires_at: expiresAt.toISOString(),
      permissions: JSON.stringify(permissions),
      pages: JSON.stringify(pages),
      ad_accounts: JSON.stringify(adAccounts)
    });

    // Stocker dans la session
    req.session.userId = userData.id;
    req.session.userName = userData.name;

    // Rediriger vers la page de succès
    res.redirect('/success.html');

  } catch (error) {
    console.error('Erreur lors de l\'échange du token:', error.response?.data || error.message);
    res.redirect(`/?error=${encodeURIComponent('Erreur lors de l\'authentification')}`);
  }
});

/**
 * Route 3: Obtenir les informations de l'utilisateur connecté
 */
app.get('/api/user', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Non authentifié' });
  }

  try {
    const user = await db.getUserByFacebookId(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Ne pas envoyer le token dans la réponse
    const { access_token, ...userWithoutToken } = user;
    userWithoutToken.permissions = JSON.parse(user.permissions || '[]');
    userWithoutToken.pages = JSON.parse(user.pages || '[]');
    userWithoutToken.ad_accounts = JSON.parse(user.ad_accounts || '[]');

    res.json(userWithoutToken);
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * Route 4: Obtenir tous les utilisateurs (pour l'agent IA)
 */
app.get('/api/users', async (req, res) => {
  try {
    const users = await db.getAllUsers();

    // Formater les données pour l'agent IA
    const formattedUsers = users.map(user => ({
      id: user.id,
      facebook_id: user.facebook_id,
      name: user.name,
      email: user.email,
      access_token: user.access_token,
      expires_at: user.expires_at,
      permissions: JSON.parse(user.permissions || '[]'),
      pages: JSON.parse(user.pages || '[]'),
      ad_accounts: JSON.parse(user.ad_accounts || '[]'),
      created_at: user.created_at,
      updated_at: user.updated_at
    }));

    res.json(formattedUsers);
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * Route 5: Révoquer l'accès d'un utilisateur
 */
app.post('/api/revoke', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Non authentifié' });
  }

  try {
    const user = await db.getUserByFacebookId(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Révoquer les permissions sur Facebook
    await axios.delete(`https://graph.facebook.com/v18.0/${user.facebook_id}/permissions`, {
      params: {
        access_token: user.access_token
      }
    });

    // Supprimer de la base de données
    await db.deleteUser(user.facebook_id);

    // Détruire la session
    req.session.destroy();

    res.json({ success: true, message: 'Accès révoqué avec succès' });
  } catch (error) {
    console.error('Erreur lors de la révocation:', error);
    res.status(500).json({ error: 'Erreur lors de la révocation' });
  }
});

// Route de debug pour afficher les informations de connexion
app.get('/debug', (req, res) => {
  if (!req.session.userId) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Debug - Non connecté</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            background: #f5f5f5;
          }
          .error {
            background: #fee;
            border: 2px solid #c33;
            padding: 20px;
            border-radius: 8px;
          }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>❌ Non connecté</h1>
          <p>Vous devez d'abord vous connecter avec Facebook.</p>
          <a href="/" style="display: inline-block; margin-top: 10px; padding: 10px 20px; background: #1877f2; color: white; text-decoration: none; border-radius: 5px;">Retour à l'accueil</a>
        </div>
      </body>
      </html>
    `);
  }

  const debug = req.session.debugInfo || {};

  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Debug OAuth Facebook</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          max-width: 1000px;
          margin: 20px auto;
          padding: 20px;
          background: #f5f5f5;
        }
        h1 {
          color: #1877f2;
          border-bottom: 3px solid #1877f2;
          padding-bottom: 10px;
        }
        .section {
          background: white;
          padding: 20px;
          margin: 20px 0;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .section h2 {
          margin-top: 0;
          color: #333;
          font-size: 1.3em;
        }
        .info {
          display: grid;
          gap: 10px;
        }
        .info-row {
          display: grid;
          grid-template-columns: 200px 1fr;
          padding: 8px;
          background: #f8f9fa;
          border-radius: 4px;
        }
        .info-label {
          font-weight: 600;
          color: #555;
        }
        .info-value {
          color: #333;
          word-break: break-all;
        }
        .permission {
          padding: 8px 12px;
          margin: 5px;
          border-radius: 5px;
          display: inline-block;
          font-size: 0.9em;
        }
        .granted {
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }
        .declined {
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }
        .page-card {
          background: #f8f9fa;
          padding: 15px;
          margin: 10px 0;
          border-radius: 8px;
          border-left: 4px solid #1877f2;
        }
        .page-card.has-instagram {
          border-left-color: #E4405F;
        }
        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 0.85em;
          font-weight: 600;
        }
        .status-success {
          background: #d4edda;
          color: #155724;
        }
        .status-warning {
          background: #fff3cd;
          color: #856404;
        }
        .status-error {
          background: #f8d7da;
          color: #721c24;
        }
        .actions {
          margin-top: 20px;
          display: flex;
          gap: 10px;
        }
        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          text-decoration: none;
          display: inline-block;
          font-size: 1em;
        }
        .btn-primary {
          background: #1877f2;
          color: white;
        }
        .btn-secondary {
          background: #6c757d;
          color: white;
        }
        .timestamp {
          color: #999;
          font-size: 0.85em;
          margin-top: 20px;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <h1>🐛 Debug OAuth Facebook</h1>

      <div class="section">
        <h2>👤 Informations Utilisateur</h2>
        <div class="info">
          <div class="info-row">
            <span class="info-label">Nom:</span>
            <span class="info-value">${debug.user?.name || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Facebook ID:</span>
            <span class="info-value">${debug.user?.id || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Email:</span>
            <span class="info-value">${debug.user?.email || 'N/A'}</span>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>🔐 Permissions Accordées</h2>
        ${debug.permissions && debug.permissions.length > 0 ? `
          <div>
            ${debug.permissions.map(perm => `
              <span class="permission ${perm.status === 'granted' ? 'granted' : 'declined'}">
                ${perm.status === 'granted' ? '✅' : '❌'} ${perm.permission}
              </span>
            `).join('')}
          </div>
        ` : '<p>Aucune permission trouvée</p>'}

        <div style="margin-top: 15px;">
          <strong>Permissions requises pour l'agent:</strong>
          <ul style="margin: 10px 0; color: #666;">
            <li>pages_show_list - Pour lister vos Pages</li>
            <li>pages_read_engagement - Pour lire les commentaires</li>
            <li>pages_manage_posts - Pour répondre aux commentaires</li>
            <li>instagram_basic - Pour accéder aux infos Instagram</li>
            <li>instagram_manage_comments - Pour gérer les commentaires Instagram</li>
          </ul>
        </div>
      </div>

      <div class="section">
        <h2>📄 Pages Facebook & Instagram</h2>
        ${debug.pages && debug.pages.length > 0 ? `
          <p><span class="status-badge status-success">${debug.pages.length} page(s) trouvée(s)</span></p>
          ${debug.pages.map(page => `
            <div class="page-card ${page.hasInstagram ? 'has-instagram' : ''}">
              <h3 style="margin: 0 0 10px 0;">📘 ${page.name}</h3>
              <div class="info-row">
                <span class="info-label">Facebook ID:</span>
                <span class="info-value">${page.id}</span>
              </div>
              ${page.hasInstagram ? `
                <div class="info-row" style="margin-top: 5px;">
                  <span class="info-label">Instagram:</span>
                  <span class="info-value">
                    <span class="status-badge status-success">✅ Connecté</span>
                    ${page.instagramUsername ? `@${page.instagramUsername}` : `ID: ${page.instagramId}`}
                  </span>
                </div>
              ` : `
                <div class="info-row" style="margin-top: 5px;">
                  <span class="info-label">Instagram:</span>
                  <span class="info-value">
                    <span class="status-badge status-warning">⚠️ Pas de compte Instagram lié à cette Page</span>
                  </span>
                </div>
              `}
            </div>
          `).join('')}
        ` : `
          <p><span class="status-badge status-error">❌ Aucune page trouvée</span></p>
          <div style="margin-top: 15px; padding: 15px; background: #fff3cd; border-radius: 5px;">
            <strong>⚠️ Raisons possibles:</strong>
            <ol style="margin: 10px 0; color: #856404;">
              <li>Vous n'avez pas de Pages Facebook</li>
              <li>Vous n'êtes pas Administrateur/Éditeur de la Page</li>
              <li><strong>Votre compte n'a pas le rôle Testeur/Développeur dans l'app Facebook</strong> (cause la plus fréquente en mode Développement)</li>
              <li>La permission <code>pages_show_list</code> n'a pas été accordée</li>
            </ol>
            <p style="margin-top: 15px; color: #856404;">
              <strong>Solution:</strong> Allez sur
              <a href="https://developers.facebook.com/apps/1364606882072627/roles/roles/" target="_blank">Meta for Developers - Rôles</a>
              et ajoutez votre compte comme <strong>Testeur</strong> minimum.
            </p>
          </div>
        `}
      </div>

      <div class="actions">
        <a href="/" class="btn btn-primary">Retour à l'accueil</a>
        <a href="/auth/logout" class="btn btn-secondary">Se déconnecter</a>
        <button onclick="location.reload()" class="btn btn-secondary">Rafraîchir</button>
      </div>

      <div class="timestamp">
        Dernière connexion: ${debug.timestamp ? new Date(debug.timestamp).toLocaleString('fr-FR') : 'N/A'}
      </div>
    </body>
    </html>
  `);
});

/**
 * Route 6: Déconnexion
 */
app.get('/auth/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

/**
 * Route 7: Vérifier le statut de connexion
 */
app.get('/api/status', (req, res) => {
  if (req.session.userId) {
    res.json({
      authenticated: true,
      userId: req.session.userId,
      userName: req.session.userName
    });
  } else {
    res.json({ authenticated: false });
  }
});

/**
 * Route 8: Sauvegarder la configuration d'un agent IA
 */
app.post('/api/agent/config', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Non authentifié' });
  }

  try {
    const user = await db.getUserByFacebookId(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const { page_id, is_active, prompt, tone, language, auto_reply_enabled, reply_delay_minutes } = req.body;

    if (!page_id || !prompt) {
      return res.status(400).json({ error: 'page_id et prompt sont requis' });
    }

    await db.saveAgentConfig({
      user_id: user.id,
      page_id,
      is_active: is_active || false,
      prompt,
      tone: tone || 'friendly',
      language: language || 'fr',
      auto_reply_enabled: auto_reply_enabled !== false,
      reply_delay_minutes: reply_delay_minutes || 0
    });

    res.json({ success: true, message: 'Configuration sauvegardée' });
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de la config:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * Route 9: Récupérer la configuration d'un agent pour une page
 */
app.get('/api/agent/config/:pageId', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Non authentifié' });
  }

  try {
    const user = await db.getUserByFacebookId(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const config = await db.getAgentConfig(user.id, req.params.pageId);

    if (!config) {
      return res.status(404).json({ error: 'Configuration non trouvée' });
    }

    res.json(config);
  } catch (error) {
    console.error('Erreur lors de la récupération de la config:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * Route 10: Récupérer les statistiques de l'agent
 */
app.get('/api/agent/stats', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Non authentifié' });
  }

  try {
    const user = await db.getUserByFacebookId(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Récupérer les configs de l'utilisateur
    const configs = await db.getUserAgentConfigs(user.id);

    // Compter les réponses
    const responsesCount = await new Promise((resolve, reject) => {
      db.db.get(
        'SELECT COUNT(*) as count FROM processed_comments WHERE user_id = ?',
        [user.id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });

    const stats = {
      total_responses: responsesCount,
      total_pages: configs.length,
      active_agents: configs.filter(c => c.is_active === 1).length
    };

    res.json(stats);
  } catch (error) {
    console.error('Erreur lors de la récupération des stats:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * Fonction utilitaire pour générer un state aléatoire (protection CSRF)
 */
function generateState() {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

// Initialiser la base de données et démarrer le serveur
db.init().then(() => {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`\n🚀 Serveur démarré sur http://localhost:${PORT}`);
    console.log(`📱 Interface d'authentification: http://localhost:${PORT}`);
    console.log(`🤖 API pour l'agent IA: http://localhost:${PORT}/api/users`);
    console.log(`⚙️  Configuration agent IA: http://localhost:${PORT}/agent-config.html`);
    console.log('\n✅ Prêt à recevoir des connexions Facebook!\n');

    // Démarrer le monitoring des commentaires
    commentMonitor.start().catch(err => {
      console.error('❌ Erreur lors du démarrage du monitoring:', err);
    });
  });
}).catch(error => {
  console.error('Erreur lors de l\'initialisation de la base de données:', error);
  process.exit(1);
});
