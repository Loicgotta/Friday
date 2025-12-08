const axios = require('axios');
const Database = require('./database');
const OpenAI = require('openai');

class CommentMonitor {
  constructor() {
    this.db = new Database();
    this.isRunning = false;
    this.checkInterval = 60000; // 1 minute par défaut
    this.intervalId = null;

    // Initialiser OpenAI
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Démarrer le monitoring des commentaires
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Le monitoring est déjà actif');
      return;
    }

    console.log('🤖 Démarrage du monitoring des commentaires...');
    this.isRunning = true;

    // Initialiser la base de données
    await this.db.init();

    // Lancer la première vérification immédiatement
    await this.checkComments();

    // Puis vérifier périodiquement
    this.intervalId = setInterval(() => {
      this.checkComments();
    }, this.checkInterval);

    console.log(`✅ Monitoring actif (vérification toutes les ${this.checkInterval / 1000} secondes)`);
  }

  /**
   * Arrêter le monitoring
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('⏸️  Monitoring arrêté');
  }

  /**
   * Vérifier les commentaires sur toutes les pages actives
   */
  async checkComments() {
    try {
      // Récupérer toutes les configurations actives
      const activeConfigs = await this.db.getActiveAgentConfigs();

      if (activeConfigs.length === 0) {
        return; // Pas de configuration active
      }

      console.log(`🔍 Vérification des commentaires pour ${activeConfigs.length} page(s)...`);

      for (const config of activeConfigs) {
        await this.checkPageComments(config);
      }

    } catch (error) {
      console.error('❌ Erreur lors de la vérification des commentaires:', error.message);
    }
  }

  /**
   * Vérifier les commentaires pour une page spécifique
   */
  async checkPageComments(config) {
    try {
      // Récupérer l'utilisateur via une requête directe
      const user = await new Promise((resolve, reject) => {
        this.db.db.get('SELECT * FROM users WHERE id = ?', [config.user_id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!user) {
        console.log(`⚠️  Utilisateur ${config.user_id} non trouvé`);
        return;
      }

      // Trouver la page dans les pages de l'utilisateur
      const pages = JSON.parse(user.pages || '[]');
      const page = pages.find(p => p.id === config.page_id);

      if (!page) {
        console.log(`⚠️  Page ${config.page_id} non trouvée`);
        return;
      }

      // Récupérer les posts récents de la page
      const postsResponse = await axios.get(
        `https://graph.facebook.com/v18.0/${config.page_id}/posts`,
        {
          params: {
            fields: 'id,message,created_time',
            limit: 10, // Les 10 derniers posts
            access_token: page.access_token
          }
        }
      );

      const posts = postsResponse.data.data || [];

      // Pour chaque post, vérifier les nouveaux commentaires
      for (const post of posts) {
        await this.checkPostComments(post, config, page.access_token, user.id);
      }

    } catch (error) {
      console.error(`❌ Erreur pour la page ${config.page_id}:`, error.response?.data || error.message);
    }
  }

  /**
   * Vérifier les commentaires d'un post spécifique
   */
  async checkPostComments(post, config, pageAccessToken, userId) {
    try {
      // Récupérer les commentaires du post
      const commentsResponse = await axios.get(
        `https://graph.facebook.com/v18.0/${post.id}/comments`,
        {
          params: {
            fields: 'id,from,message,created_time',
            limit: 50,
            access_token: pageAccessToken
          }
        }
      );

      const comments = commentsResponse.data.data || [];

      for (const comment of comments) {
        // Vérifier si ce commentaire a déjà été traité
        const alreadyProcessed = await this.db.isCommentProcessed(comment.id);

        if (!alreadyProcessed && config.auto_reply_enabled) {
          // Attendre le délai configuré si nécessaire
          if (config.reply_delay_minutes > 0) {
            const commentTime = new Date(comment.created_time);
            const now = new Date();
            const minutesSinceComment = (now - commentTime) / 1000 / 60;

            if (minutesSinceComment < config.reply_delay_minutes) {
              continue; // Pas encore temps de répondre
            }
          }

          // Générer et poster la réponse
          await this.replyToComment(comment, post, config, pageAccessToken, userId);
        }
      }

    } catch (error) {
      console.error(`❌ Erreur pour le post ${post.id}:`, error.response?.data || error.message);
    }
  }

  /**
   * Répondre à un commentaire
   */
  async replyToComment(comment, post, config, pageAccessToken, userId) {
    try {
      // Générer la réponse basée sur le prompt configuré
      const replyText = await this.generateReply(comment.message, config);

      // Poster la réponse
      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${comment.id}/comments`,
        {
          message: replyText
        },
        {
          params: {
            access_token: pageAccessToken
          }
        }
      );

      // Marquer le commentaire comme traité
      await this.db.markCommentAsProcessed(
        comment.id,
        post.id,
        config.page_id,
        userId,
        replyText
      );

      console.log(`✅ Réponse postée sur le commentaire ${comment.id}`);
      console.log(`   Commentaire: "${comment.message}"`);
      console.log(`   Réponse: "${replyText}"`);

    } catch (error) {
      console.error(`❌ Erreur lors de la réponse au commentaire ${comment.id}:`, error.response?.data || error.message);
    }
  }

  /**
   * Générer une réponse basée sur le prompt et le commentaire avec OpenAI
   */
  async generateReply(commentMessage, config) {
    try {
      // Construire le message système basé sur la configuration
      const toneInstructions = {
        friendly: 'Sois chaleureux, amical et accueillant.',
        professional: 'Sois professionnel, courtois et formel.',
        casual: 'Sois décontracté, relaxé et informel. Tu peux utiliser des emojis occasionnellement.'
      };

      const systemMessage = `${config.prompt}

Ton: ${toneInstructions[config.tone] || toneInstructions.friendly}
Langue: ${config.language === 'fr' ? 'Français' : config.language === 'en' ? 'English' : 'Español'}

Instructions importantes:
- Réponds UNIQUEMENT au commentaire, pas d'introduction
- Sois concis (2-3 phrases maximum)
- Respecte le ton et le comportement défini
- Adapte ta réponse au contexte du commentaire`;

      // Appeler OpenAI pour générer la réponse
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Modèle rapide et économique
        messages: [
          {
            role: 'system',
            content: systemMessage
          },
          {
            role: 'user',
            content: commentMessage
          }
        ],
        temperature: 0.7,
        max_tokens: 150
      });

      const reply = completion.choices[0].message.content.trim();

      console.log(`🤖 Réponse OpenAI générée pour: "${commentMessage}"`);
      return reply;

    } catch (error) {
      console.error('❌ Erreur OpenAI:', error.message);

      // Fallback: réponse simple en cas d'erreur OpenAI
      const fallbackMessages = {
        friendly: `Merci pour votre commentaire ! 😊`,
        professional: `Nous vous remercions pour votre retour.`,
        casual: `Hey ! Merci pour ton commentaire 👍`
      };

      return fallbackMessages[config.tone] || fallbackMessages.friendly;
    }
  }

  /**
   * Obtenir le statut du monitoring
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
      intervalInSeconds: this.checkInterval / 1000
    };
  }

  /**
   * Changer l'intervalle de vérification
   */
  setCheckInterval(milliseconds) {
    this.checkInterval = milliseconds;

    if (this.isRunning) {
      // Redémarrer avec le nouvel intervalle
      this.stop();
      this.start();
    }
  }
}

module.exports = CommentMonitor;
