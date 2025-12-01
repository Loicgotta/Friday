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

    return new Promise((resolve, reject) => {
      this.db.run(createUsersTable, (err) => {
        if (err) {
          console.error('Erreur lors de la création de la table:', err);
          reject(err);
        } else {
          console.log('✅ Table users créée/vérifiée');
          resolve();
        }
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
