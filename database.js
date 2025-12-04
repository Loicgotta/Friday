/**
 * Module de base de données SQLite pour Friday
 * Gère le stockage des utilisateurs et des sessions
 */

const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class FridayDatabase {
  constructor() {
    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'friday.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.init();
  }

  /**
   * Initialiser les tables de la base de données
   */
  init() {
    // Table des utilisateurs
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        google_id TEXT UNIQUE NOT NULL,
        email TEXT NOT NULL,
        name TEXT NOT NULL,
        picture TEXT,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        token_expiry TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table des sessions de conversation
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Table des messages
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        sources TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
      )
    `);

    // Table des fichiers indexés
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS indexed_files (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        file_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        mime_type TEXT,
        indexed_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, file_id)
      )
    `);

    console.log('Base de données initialisée');
  }

  // ========== Méthodes pour les utilisateurs ==========

  /**
   * Créer ou mettre à jour un utilisateur
   */
  saveUser(userData) {
    const {
      google_id,
      email,
      name,
      picture,
      access_token,
      refresh_token,
      token_expiry
    } = userData;

    const existingUser = this.getUserByGoogleId(google_id);

    if (existingUser) {
      // Mettre à jour
      const stmt = this.db.prepare(`
        UPDATE users SET
          email = ?,
          name = ?,
          picture = ?,
          access_token = ?,
          refresh_token = COALESCE(?, refresh_token),
          token_expiry = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE google_id = ?
      `);

      stmt.run(email, name, picture, access_token, refresh_token, token_expiry, google_id);
      return existingUser.id;
    } else {
      // Créer
      const id = uuidv4();
      const stmt = this.db.prepare(`
        INSERT INTO users (id, google_id, email, name, picture, access_token, refresh_token, token_expiry)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(id, google_id, email, name, picture, access_token, refresh_token, token_expiry);
      return id;
    }
  }

  /**
   * Récupérer un utilisateur par son ID Google
   */
  getUserByGoogleId(googleId) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE google_id = ?');
    return stmt.get(googleId);
  }

  /**
   * Récupérer un utilisateur par son ID interne
   */
  getUserById(id) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id);
  }

  /**
   * Mettre à jour les tokens d'un utilisateur
   */
  updateUserTokens(userId, tokens) {
    const stmt = this.db.prepare(`
      UPDATE users SET
        access_token = ?,
        refresh_token = COALESCE(?, refresh_token),
        token_expiry = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(tokens.access_token, tokens.refresh_token, tokens.expiry_date, userId);
  }

  /**
   * Supprimer un utilisateur
   */
  deleteUser(userId) {
    // Supprimer les messages
    this.db.prepare('DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = ?)').run(userId);
    // Supprimer les conversations
    this.db.prepare('DELETE FROM conversations WHERE user_id = ?').run(userId);
    // Supprimer les fichiers indexés
    this.db.prepare('DELETE FROM indexed_files WHERE user_id = ?').run(userId);
    // Supprimer l'utilisateur
    this.db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  }

  // ========== Méthodes pour les conversations ==========

  /**
   * Créer une nouvelle conversation
   */
  createConversation(userId, title = 'Nouvelle conversation') {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO conversations (id, user_id, title)
      VALUES (?, ?, ?)
    `);

    stmt.run(id, userId, title);
    return id;
  }

  /**
   * Récupérer les conversations d'un utilisateur
   */
  getConversations(userId) {
    const stmt = this.db.prepare(`
      SELECT * FROM conversations
      WHERE user_id = ?
      ORDER BY updated_at DESC
    `);

    return stmt.all(userId);
  }

  /**
   * Récupérer une conversation par son ID
   */
  getConversation(conversationId) {
    const stmt = this.db.prepare('SELECT * FROM conversations WHERE id = ?');
    return stmt.get(conversationId);
  }

  /**
   * Mettre à jour le titre d'une conversation
   */
  updateConversationTitle(conversationId, title) {
    const stmt = this.db.prepare(`
      UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(title, conversationId);
  }

  /**
   * Supprimer une conversation et ses messages
   */
  deleteConversation(conversationId) {
    this.db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(conversationId);
    this.db.prepare('DELETE FROM conversations WHERE id = ?').run(conversationId);
  }

  // ========== Méthodes pour les messages ==========

  /**
   * Ajouter un message à une conversation
   */
  addMessage(conversationId, role, content, sources = null) {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, sources)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(id, conversationId, role, content, sources ? JSON.stringify(sources) : null);

    // Mettre à jour la date de la conversation
    this.db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(conversationId);

    return id;
  }

  /**
   * Récupérer les messages d'une conversation
   */
  getMessages(conversationId) {
    const stmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `);

    const messages = stmt.all(conversationId);

    return messages.map(msg => ({
      ...msg,
      sources: msg.sources ? JSON.parse(msg.sources) : null
    }));
  }

  // ========== Méthodes pour les fichiers indexés ==========

  /**
   * Enregistrer un fichier indexé
   */
  saveIndexedFile(userId, fileId, fileName, mimeType) {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO indexed_files (id, user_id, file_id, file_name, mime_type, indexed_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    stmt.run(id, userId, fileId, fileName, mimeType);
  }

  /**
   * Récupérer les fichiers indexés d'un utilisateur
   */
  getIndexedFiles(userId) {
    const stmt = this.db.prepare(`
      SELECT * FROM indexed_files
      WHERE user_id = ?
      ORDER BY indexed_at DESC
    `);

    return stmt.all(userId);
  }

  /**
   * Effacer les fichiers indexés d'un utilisateur
   */
  clearIndexedFiles(userId) {
    this.db.prepare('DELETE FROM indexed_files WHERE user_id = ?').run(userId);
  }

  /**
   * Fermer la base de données
   */
  close() {
    this.db.close();
  }
}

module.exports = FridayDatabase;
