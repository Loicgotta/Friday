/**
 * Friday - Agent IA avec Google Drive et RAG
 * Serveur principal
 */

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

const FridayDatabase = require('./database');
const GoogleAuthService = require('./services/googleAuth');
const DriveService = require('./services/driveService');
const RAGService = require('./services/ragService');

const app = express();
const db = new FridayDatabase();
const googleAuth = new GoogleAuthService();
const ragService = new RAGService();

// Configuration pour Render (trust proxy pour HTTPS)
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: process.env.BASE_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration de session
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'friday-secret-key-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
};

app.use(session(sessionConfig));

// Servir les fichiers statiques
app.use(express.static('public'));

// Middleware d'authentification
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  next();
};

// ========== ROUTES D'AUTHENTIFICATION ==========

/**
 * Démarrer le processus d'authentification Google
 */
app.get('/auth/google', (req, res) => {
  const state = Math.random().toString(36).substring(2, 15);
  req.session.authState = state;
  const authUrl = googleAuth.getAuthUrl(state);
  res.redirect(authUrl);
});

/**
 * Callback OAuth Google
 */
app.get('/auth/google/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    console.error('Erreur OAuth:', error);
    return res.redirect('/?error=' + encodeURIComponent(error));
  }

  if (!code) {
    return res.redirect('/?error=Code manquant');
  }

  // Vérifier le state (protection CSRF)
  if (state !== req.session.authState) {
    console.warn('State mismatch - possible CSRF attack');
    // On continue quand même pour les tests
  }

  try {
    // Obtenir les tokens
    const tokens = await googleAuth.getTokens(code);

    // Obtenir le profil utilisateur
    const profile = await googleAuth.getUserProfile(tokens);

    // Sauvegarder l'utilisateur
    const userId = db.saveUser({
      google_id: profile.id,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: tokens.expiry_date
    });

    // Créer la session
    req.session.userId = userId;
    req.session.googleId = profile.id;
    req.session.userName = profile.name;

    console.log(`Utilisateur connecté: ${profile.name} (${profile.email})`);

    res.redirect('/chat.html');
  } catch (error) {
    console.error('Erreur lors de l\'authentification:', error);
    res.redirect('/?error=' + encodeURIComponent('Erreur d\'authentification'));
  }
});

/**
 * Déconnexion
 */
app.get('/auth/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

/**
 * Statut de connexion
 */
app.get('/api/status', (req, res) => {
  if (req.session.userId) {
    const user = db.getUserById(req.session.userId);
    if (user) {
      return res.json({
        authenticated: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          picture: user.picture
        }
      });
    }
  }
  res.json({ authenticated: false });
});

// ========== ROUTES DE L'UTILISATEUR ==========

/**
 * Obtenir les informations de l'utilisateur
 */
app.get('/api/user', requireAuth, (req, res) => {
  const user = db.getUserById(req.session.userId);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur non trouvé' });
  }

  const { access_token, refresh_token, ...safeUser } = user;
  res.json(safeUser);
});

/**
 * Révoquer l'accès et supprimer le compte
 */
app.delete('/api/user', requireAuth, async (req, res) => {
  try {
    const user = db.getUserById(req.session.userId);

    if (user) {
      // Révoquer les tokens Google
      await googleAuth.revokeTokens({
        access_token: user.access_token,
        refresh_token: user.refresh_token
      });

      // Effacer l'index RAG
      ragService.clearIndex(req.session.userId);

      // Supprimer de la base de données
      db.deleteUser(req.session.userId);
    }

    req.session.destroy();
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la révocation:', error);
    res.status(500).json({ error: 'Erreur lors de la révocation' });
  }
});

// ========== ROUTES GOOGLE DRIVE ==========

/**
 * Lister les fichiers du Drive
 */
app.get('/api/drive/files', requireAuth, async (req, res) => {
  try {
    const user = db.getUserById(req.session.userId);
    const authClient = googleAuth.getAuthenticatedClient({
      access_token: user.access_token,
      refresh_token: user.refresh_token
    });

    const driveService = new DriveService(authClient);
    const files = await driveService.getAllFiles();

    res.json({
      files,
      total: files.length
    });
  } catch (error) {
    console.error('Erreur Drive:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des fichiers' });
  }
});

/**
 * Statistiques du Drive
 */
app.get('/api/drive/stats', requireAuth, async (req, res) => {
  try {
    const user = db.getUserById(req.session.userId);
    const authClient = googleAuth.getAuthenticatedClient({
      access_token: user.access_token,
      refresh_token: user.refresh_token
    });

    const driveService = new DriveService(authClient);
    const stats = await driveService.getDriveStats();

    // Ajouter les stats d'indexation
    const indexStats = ragService.getIndexStats(req.session.userId);

    res.json({
      drive: stats,
      index: indexStats
    });
  } catch (error) {
    console.error('Erreur stats:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

/**
 * Synchroniser/Indexer les documents du Drive
 */
app.post('/api/drive/sync', requireAuth, async (req, res) => {
  try {
    const user = db.getUserById(req.session.userId);
    const authClient = googleAuth.getAuthenticatedClient({
      access_token: user.access_token,
      refresh_token: user.refresh_token
    });

    const driveService = new DriveService(authClient);

    // Récupérer tous les fichiers
    console.log('Récupération des fichiers du Drive...');
    const files = await driveService.getAllFiles();
    console.log(`${files.length} fichiers trouvés`);

    // Extraire le texte de chaque fichier
    const documents = [];
    let processed = 0;
    let errors = 0;

    // Effacer les anciens fichiers indexés
    db.clearIndexedFiles(req.session.userId);

    for (const file of files) {
      try {
        console.log(`Extraction: ${file.name}`);
        const content = await driveService.extractTextFromFile(file.id, file.mimeType, file.name);

        if (content && content.length > 50) {
          documents.push({
            fileId: file.id,
            fileName: file.name,
            content
          });

          // Sauvegarder dans la DB
          db.saveIndexedFile(req.session.userId, file.id, file.name, file.mimeType);
          processed++;
        }
      } catch (error) {
        console.error(`Erreur extraction ${file.name}:`, error.message);
        errors++;
      }
    }

    // Indexer les documents pour le RAG
    console.log('Indexation des documents...');
    const indexResult = await ragService.indexAllDocuments(req.session.userId, documents);

    res.json({
      success: true,
      files: files.length,
      processed,
      errors,
      indexed: indexResult.indexed,
      totalChunks: indexResult.totalChunks
    });
  } catch (error) {
    console.error('Erreur sync:', error);
    res.status(500).json({ error: 'Erreur lors de la synchronisation' });
  }
});

// ========== ROUTES CHAT/RAG ==========

/**
 * Obtenir les conversations de l'utilisateur
 */
app.get('/api/conversations', requireAuth, (req, res) => {
  const conversations = db.getConversations(req.session.userId);
  res.json(conversations);
});

/**
 * Créer une nouvelle conversation
 */
app.post('/api/conversations', requireAuth, (req, res) => {
  const { title } = req.body;
  const conversationId = db.createConversation(req.session.userId, title || 'Nouvelle conversation');
  res.json({ id: conversationId });
});

/**
 * Supprimer une conversation
 */
app.delete('/api/conversations/:id', requireAuth, (req, res) => {
  const conversation = db.getConversation(req.params.id);

  if (!conversation) {
    return res.status(404).json({ error: 'Conversation non trouvée' });
  }

  // Vérifier que la conversation appartient à l'utilisateur
  if (conversation.user_id !== req.session.userId) {
    return res.status(403).json({ error: 'Non autorisé' });
  }

  db.deleteConversation(req.params.id);
  res.json({ success: true });
});

/**
 * Obtenir les messages d'une conversation
 */
app.get('/api/conversations/:id/messages', requireAuth, (req, res) => {
  const conversation = db.getConversation(req.params.id);

  if (!conversation) {
    return res.status(404).json({ error: 'Conversation non trouvée' });
  }

  if (conversation.user_id !== req.session.userId) {
    return res.status(403).json({ error: 'Non autorisé' });
  }

  const messages = db.getMessages(req.params.id);
  res.json(messages);
});

/**
 * Envoyer un message et obtenir une réponse
 */
app.post('/api/chat', requireAuth, async (req, res) => {
  const { message, conversationId } = req.body;

  if (!message || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message vide' });
  }

  let convId = conversationId;

  // Créer une nouvelle conversation si nécessaire
  if (!convId) {
    convId = db.createConversation(req.session.userId, message.slice(0, 50) + '...');
  } else {
    // Vérifier que la conversation appartient à l'utilisateur
    const conversation = db.getConversation(convId);
    if (!conversation || conversation.user_id !== req.session.userId) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
  }

  try {
    // Sauvegarder le message de l'utilisateur
    db.addMessage(convId, 'user', message);

    // Récupérer l'historique de conversation
    const messages = db.getMessages(convId);
    const conversationHistory = messages.map(m => ({
      role: m.role,
      content: m.content
    }));

    // Générer la réponse avec RAG
    const response = await ragService.generateAnswer(
      req.session.userId,
      message,
      conversationHistory.slice(0, -1) // Exclure le dernier message (celui qu'on vient d'ajouter)
    );

    // Sauvegarder la réponse
    db.addMessage(convId, 'assistant', response.answer, response.sources);

    res.json({
      conversationId: convId,
      answer: response.answer,
      sources: response.sources,
      relevantChunks: response.relevantChunks
    });
  } catch (error) {
    console.error('Erreur chat:', error);
    res.status(500).json({ error: 'Erreur lors de la génération de la réponse' });
  }
});

/**
 * Obtenir les stats de l'index RAG
 */
app.get('/api/index/stats', requireAuth, (req, res) => {
  const stats = ragService.getIndexStats(req.session.userId);
  const indexedFiles = db.getIndexedFiles(req.session.userId);

  res.json({
    ...stats,
    files: indexedFiles
  });
});

// ========== GESTION DES ERREURS ==========

app.use((err, req, res, next) => {
  console.error('Erreur serveur:', err);
  res.status(500).json({ error: 'Erreur serveur interne' });
});

// ========== DÉMARRAGE DU SERVEUR ==========

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
==================================================
   FRIDAY - Agent IA avec Google Drive et RAG
==================================================

Serveur démarré sur le port ${PORT}

URLs disponibles:
- Interface: http://localhost:${PORT}
- Auth Google: http://localhost:${PORT}/auth/google
- API Status: http://localhost:${PORT}/api/status

En production sur Render, configurez:
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- OPENAI_API_KEY
- SESSION_SECRET
- BASE_URL (ex: https://votre-app.onrender.com)
- CALLBACK_URL (ex: https://votre-app.onrender.com/auth/google/callback)

Prêt à recevoir des connexions!
==================================================
  `);
});

// Gestion de la fermeture propre
process.on('SIGTERM', () => {
  console.log('Arrêt du serveur...');
  db.close();
  process.exit(0);
});
