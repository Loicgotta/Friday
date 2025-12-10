const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.dbPath = path.join(__dirname, 'users.db');
    this.db = null;
  }

  /**
   * Initialiser la base de données et créer les tables
   */
  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Erreur lors de l\'ouverture de la base de données:', err);
          reject(err);
        } else {
          console.log('✅ Base de données connectée');
          this.createTables()
            .then(resolve)
            .catch(reject);
        }
      });
    });
  }

  /**
   * Créer les tables nécessaires
   */
  async createTables() {
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        facebook_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        email TEXT,
        access_token TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        permissions TEXT,
        pages TEXT,
        ad_accounts TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createAgentConfigsTable = `
      CREATE TABLE IF NOT EXISTS agent_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        page_id TEXT NOT NULL,
        is_active INTEGER DEFAULT 0,
        prompt TEXT NOT NULL,
        tone TEXT DEFAULT 'friendly',
        language TEXT DEFAULT 'fr',
        auto_reply_enabled INTEGER DEFAULT 1,
        reply_delay_minutes INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, page_id)
      )
    `;

    const createProcessedCommentsTable = `
      CREATE TABLE IF NOT EXISTS processed_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        comment_id TEXT UNIQUE NOT NULL,
        post_id TEXT NOT NULL,
        page_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        replied_at TEXT DEFAULT CURRENT_TIMESTAMP,
        reply_text TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `;

    const createInstagramAccountsTable = `
      CREATE TABLE IF NOT EXISTS instagram_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        instagram_id TEXT NOT NULL,
        username TEXT NOT NULL,
        name TEXT,
        access_token TEXT NOT NULL,
        token_expires_at TEXT,
        profile_picture_url TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, instagram_id)
      )
    `;

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run(createUsersTable, (err) => {
          if (err) {
            console.error('Erreur lors de la création de la table users:', err);
            return reject(err);
          }
          console.log('✅ Table users créée/vérifiée');
        });

        this.db.run(createAgentConfigsTable, (err) => {
          if (err) {
            console.error('Erreur lors de la création de la table agent_configs:', err);
            return reject(err);
          }
          console.log('✅ Table agent_configs créée/vérifiée');
        });

        this.db.run(createProcessedCommentsTable, (err) => {
          if (err) {
            console.error('Erreur lors de la création de la table processed_comments:', err);
            return reject(err);
          }
          console.log('✅ Table processed_comments créée/vérifiée');
        });

        this.db.run(createInstagramAccountsTable, (err) => {
          if (err) {
            console.error('Erreur lors de la création de la table instagram_accounts:', err);
            return reject(err);
          }
          console.log('✅ Table instagram_accounts créée/vérifiée');
          resolve();
        });
      });
    });
  }

  /**
   * Sauvegarder ou mettre à jour un utilisateur
   */
  async saveUser(userData) {
    const {
      facebook_id,
      name,
      email,
      access_token,
      expires_at,
      permissions,
      pages,
      ad_accounts
    } = userData;

    const query = `
      INSERT INTO users (facebook_id, name, email, access_token, expires_at, permissions, pages, ad_accounts, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(facebook_id) DO UPDATE SET
        name = excluded.name,
        email = excluded.email,
        access_token = excluded.access_token,
        expires_at = excluded.expires_at,
        permissions = excluded.permissions,
        pages = excluded.pages,
        ad_accounts = excluded.ad_accounts,
        updated_at = CURRENT_TIMESTAMP
    `;

    return new Promise((resolve, reject) => {
      this.db.run(
        query,
        [facebook_id, name, email, access_token, expires_at, permissions, pages, ad_accounts],
        function(err) {
          if (err) {
            console.error('Erreur lors de la sauvegarde de l\'utilisateur:', err);
            reject(err);
          } else {
            console.log(`✅ Utilisateur ${name} sauvegardé/mis à jour (ID: ${this.lastID})`);
            resolve(this.lastID);
          }
        }
      );
    });
  }

  /**
   * Récupérer un utilisateur par son Facebook ID
   */
  async getUserByFacebookId(facebookId) {
    const query = 'SELECT * FROM users WHERE facebook_id = ?';

    return new Promise((resolve, reject) => {
      this.db.get(query, [facebookId], (err, row) => {
        if (err) {
          console.error('Erreur lors de la récupération de l\'utilisateur:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Récupérer tous les utilisateurs (pour l'agent IA)
   */
  async getAllUsers() {
    const query = 'SELECT * FROM users ORDER BY created_at DESC';

    return new Promise((resolve, reject) => {
      this.db.all(query, [], (err, rows) => {
        if (err) {
          console.error('Erreur lors de la récupération des utilisateurs:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Supprimer un utilisateur
   */
  async deleteUser(facebookId) {
    const query = 'DELETE FROM users WHERE facebook_id = ?';

    return new Promise((resolve, reject) => {
      this.db.run(query, [facebookId], function(err) {
        if (err) {
          console.error('Erreur lors de la suppression de l\'utilisateur:', err);
          reject(err);
        } else {
          console.log(`✅ Utilisateur supprimé (Facebook ID: ${facebookId})`);
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Obtenir les utilisateurs dont le token va bientôt expirer
   */
  async getUsersWithExpiringTokens(daysBeforeExpiry = 7) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysBeforeExpiry);

    const query = 'SELECT * FROM users WHERE datetime(expires_at) <= datetime(?)';

    return new Promise((resolve, reject) => {
      this.db.all(query, [expiryDate.toISOString()], (err, rows) => {
        if (err) {
          console.error('Erreur lors de la récupération des tokens expirants:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Sauvegarder ou mettre à jour une configuration d'agent IA
   */
  async saveAgentConfig(config) {
    const {
      user_id,
      page_id,
      is_active,
      prompt,
      tone,
      language,
      auto_reply_enabled,
      reply_delay_minutes
    } = config;

    const query = `
      INSERT INTO agent_configs (user_id, page_id, is_active, prompt, tone, language, auto_reply_enabled, reply_delay_minutes, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, page_id) DO UPDATE SET
        is_active = excluded.is_active,
        prompt = excluded.prompt,
        tone = excluded.tone,
        language = excluded.language,
        auto_reply_enabled = excluded.auto_reply_enabled,
        reply_delay_minutes = excluded.reply_delay_minutes,
        updated_at = CURRENT_TIMESTAMP
    `;

    return new Promise((resolve, reject) => {
      this.db.run(
        query,
        [user_id, page_id, is_active ? 1 : 0, prompt, tone, language, auto_reply_enabled ? 1 : 0, reply_delay_minutes],
        function(err) {
          if (err) {
            console.error('Erreur lors de la sauvegarde de la config agent:', err);
            reject(err);
          } else {
            console.log(`✅ Configuration agent sauvegardée pour page ${page_id}`);
            resolve(this.lastID);
          }
        }
      );
    });
  }

  /**
   * Récupérer la configuration d'agent pour une page spécifique
   */
  async getAgentConfig(userId, pageId) {
    const query = 'SELECT * FROM agent_configs WHERE user_id = ? AND page_id = ?';

    return new Promise((resolve, reject) => {
      this.db.get(query, [userId, pageId], (err, row) => {
        if (err) {
          console.error('Erreur lors de la récupération de la config agent:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Récupérer toutes les configurations actives
   */
  async getActiveAgentConfigs() {
    const query = 'SELECT * FROM agent_configs WHERE is_active = 1';

    return new Promise((resolve, reject) => {
      this.db.all(query, [], (err, rows) => {
        if (err) {
          console.error('Erreur lors de la récupération des configs actives:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Récupérer toutes les configurations d'un utilisateur
   */
  async getUserAgentConfigs(userId) {
    const query = 'SELECT * FROM agent_configs WHERE user_id = ?';

    return new Promise((resolve, reject) => {
      this.db.all(query, [userId], (err, rows) => {
        if (err) {
          console.error('Erreur lors de la récupération des configs utilisateur:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Marquer un commentaire comme traité
   */
  async markCommentAsProcessed(commentId, postId, pageId, userId, replyText) {
    const query = `
      INSERT INTO processed_comments (comment_id, post_id, page_id, user_id, reply_text)
      VALUES (?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(query, [commentId, postId, pageId, userId, replyText], function(err) {
        if (err) {
          console.error('Erreur lors du marquage du commentaire:', err);
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  /**
   * Vérifier si un commentaire a déjà été traité
   */
  async isCommentProcessed(commentId) {
    const query = 'SELECT * FROM processed_comments WHERE comment_id = ?';

    return new Promise((resolve, reject) => {
      this.db.get(query, [commentId], (err, row) => {
        if (err) {
          console.error('Erreur lors de la vérification du commentaire:', err);
          reject(err);
        } else {
          resolve(!!row);
        }
      });
    });
  }

  /**
   * Sauvegarder ou mettre à jour un compte Instagram
   */
  async saveInstagramAccount(accountData) {
    const {
      user_id,
      instagram_id,
      username,
      name,
      access_token,
      token_expires_at,
      profile_picture_url
    } = accountData;

    const query = `
      INSERT INTO instagram_accounts (user_id, instagram_id, username, name, access_token, token_expires_at, profile_picture_url, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, instagram_id) DO UPDATE SET
        username = excluded.username,
        name = excluded.name,
        access_token = excluded.access_token,
        token_expires_at = excluded.token_expires_at,
        profile_picture_url = excluded.profile_picture_url,
        updated_at = CURRENT_TIMESTAMP
    `;

    return new Promise((resolve, reject) => {
      this.db.run(
        query,
        [user_id, instagram_id, username, name, access_token, token_expires_at, profile_picture_url],
        function(err) {
          if (err) {
            console.error('Erreur lors de la sauvegarde du compte Instagram:', err);
            reject(err);
          } else {
            console.log(`✅ Compte Instagram @${username} sauvegardé`);
            resolve(this.lastID);
          }
        }
      );
    });
  }

  /**
   * Récupérer tous les comptes Instagram d'un utilisateur
   */
  async getInstagramAccountsByUserId(userId) {
    const query = 'SELECT * FROM instagram_accounts WHERE user_id = ?';

    return new Promise((resolve, reject) => {
      this.db.all(query, [userId], (err, rows) => {
        if (err) {
          console.error('Erreur lors de la récupération des comptes Instagram:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Récupérer un compte Instagram par son ID
   */
  async getInstagramAccountById(instagramId) {
    const query = 'SELECT * FROM instagram_accounts WHERE instagram_id = ?';

    return new Promise((resolve, reject) => {
      this.db.get(query, [instagramId], (err, row) => {
        if (err) {
          console.error('Erreur lors de la récupération du compte Instagram:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Supprimer un compte Instagram
   */
  async deleteInstagramAccount(userId, instagramId) {
    const query = 'DELETE FROM instagram_accounts WHERE user_id = ? AND instagram_id = ?';

    return new Promise((resolve, reject) => {
      this.db.run(query, [userId, instagramId], function(err) {
        if (err) {
          console.error('Erreur lors de la suppression du compte Instagram:', err);
          reject(err);
        } else {
          console.log(`✅ Compte Instagram supprimé`);
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Fermer la connexion à la base de données
   */
  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Erreur lors de la fermeture de la base de données:', err);
        } else {
          console.log('✅ Base de données fermée');
        }
      });
    }
  }
}

module.exports = Database;
