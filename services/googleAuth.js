/**
 * Service d'authentification Google OAuth 2.0
 * Gère la connexion et l'accès au Google Drive de l'utilisateur
 */

const { google } = require('googleapis');

class GoogleAuthService {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.CALLBACK_URL
    );

    // Scopes pour accéder au Google Drive en lecture seule
    this.SCOPES = [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email'
    ];
  }

  /**
   * Générer l'URL d'authentification Google
   */
  getAuthUrl(state = null) {
    const params = {
      access_type: 'offline',
      scope: this.SCOPES,
      prompt: 'consent', // Force le refresh token
      include_granted_scopes: true
    };

    if (state) {
      params.state = state;
    }

    return this.oauth2Client.generateAuthUrl(params);
  }

  /**
   * Échanger le code d'autorisation contre des tokens
   */
  async getTokens(code) {
    const { tokens } = await this.oauth2Client.getToken(code);
    return tokens;
  }

  /**
   * Créer un client OAuth configuré avec les tokens de l'utilisateur
   */
  getAuthenticatedClient(tokens) {
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.CALLBACK_URL
    );
    client.setCredentials(tokens);
    return client;
  }

  /**
   * Récupérer les informations du profil utilisateur
   */
  async getUserProfile(tokens) {
    const client = this.getAuthenticatedClient(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data } = await oauth2.userinfo.get();
    return data;
  }

  /**
   * Rafraîchir le token d'accès si nécessaire
   */
  async refreshTokenIfNeeded(tokens) {
    if (!tokens.expiry_date || tokens.expiry_date > Date.now()) {
      return tokens;
    }

    const client = this.getAuthenticatedClient(tokens);
    const { credentials } = await client.refreshAccessToken();
    return credentials;
  }

  /**
   * Vérifier si les tokens sont valides
   */
  async validateTokens(tokens) {
    try {
      const client = this.getAuthenticatedClient(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: client });
      await oauth2.userinfo.get();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Révoquer les tokens d'accès
   */
  async revokeTokens(tokens) {
    try {
      const client = this.getAuthenticatedClient(tokens);
      await client.revokeCredentials();
      return true;
    } catch (error) {
      console.error('Erreur lors de la révocation des tokens:', error);
      return false;
    }
  }
}

module.exports = GoogleAuthService;
