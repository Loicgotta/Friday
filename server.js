require('dotenv').config();
const express = require('express');
const session = require('express-session');
const axios = require('axios');
const cors = require('cors');
const Database = require('./database');

const app = express();
const db = new Database();

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

// Permissions Facebook requises pour l'agent IA
const FACEBOOK_PERMISSIONS = [
  // Gestion des publicités
  'ads_management',
  'ads_read',
  'business_management',

  // Gestion des Pages
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_metadata',
  'pages_manage_ads',
  'pages_manage_posts',
  'pages_manage_engagement',

  // Instagram
  'instagram_basic',
  'instagram_manage_comments',
  'instagram_manage_messages',
  'instagram_content_publish',

  // Leads et insights
  'leads_retrieval',
  'read_insights',

  // Informations de base
  'email',
  'public_profile'
].join(',');

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
    const tokenResponse = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        redirect_uri: process.env.CALLBACK_URL,
        code: code
      }
    });

    const { access_token, expires_in } = tokenResponse.data;

    // Échanger le short-lived token contre un long-lived token
    const longLivedTokenResponse = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
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

    // Récupérer les pages et comptes Instagram de l'utilisateur
    const accountsResponse = await axios.get('https://graph.facebook.com/v18.0/me/accounts', {
      params: {
        access_token: longLivedToken
      }
    });

    const pages = accountsResponse.data.data;

    // Récupérer les comptes publicitaires
    const adAccountsResponse = await axios.get('https://graph.facebook.com/v18.0/me/adaccounts', {
      params: {
        fields: 'id,name,account_id,account_status',
        access_token: longLivedToken
      }
    });

    const adAccounts = adAccountsResponse.data.data;

    // Récupérer les permissions accordées
    const permissionsResponse = await axios.get('https://graph.facebook.com/v18.0/me/permissions', {
      params: {
        access_token: longLivedToken
      }
    });

    const permissions = permissionsResponse.data.data
      .filter(p => p.status === 'granted')
      .map(p => p.permission);

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
    console.log('\n✅ Prêt à recevoir des connexions Facebook!\n');
  });
}).catch(error => {
  console.error('Erreur lors de l\'initialisation de la base de données:', error);
  process.exit(1);
});
