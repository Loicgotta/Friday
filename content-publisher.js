const axios = require('axios');
const Database = require('./database');

class ContentPublisher {
  constructor() {
    this.db = new Database();
    this.isRunning = false;
    this.checkInterval = 30000; // 30 secondes
    this.intervalId = null;
  }

  /**
   * Démarrer le système de publication automatique
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Le système de publication est déjà actif');
      return;
    }

    console.log('📤 Démarrage du système de publication automatique...');
    this.isRunning = true;

    // Initialiser la base de données
    await this.db.init();

    // Lancer la première vérification immédiatement
    await this.checkScheduledContent();

    // Puis vérifier périodiquement
    this.intervalId = setInterval(() => {
      this.checkScheduledContent();
    }, this.checkInterval);

    console.log(`✅ Système de publication actif (vérification toutes les ${this.checkInterval / 1000} secondes)`);
  }

  /**
   * Arrêter le système de publication
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('⏸️  Système de publication arrêté');
  }

  /**
   * Vérifier et publier le contenu programmé
   */
  async checkScheduledContent() {
    try {
      // Récupérer tout le contenu prêt à être publié
      const pendingContent = await this.db.getPendingScheduledContent();

      if (pendingContent.length === 0) {
        return; // Rien à publier
      }

      console.log(`📋 ${pendingContent.length} contenu(s) à publier...`);

      for (const content of pendingContent) {
        try {
          // Marquer comme "en cours de publication"
          await this.db.updateScheduledContentStatus(content.id, 'publishing');

          // Publier selon le type de compte
          if (content.account_type === 'instagram') {
            await this.publishToInstagram(content);
          } else if (content.account_type === 'facebook') {
            await this.publishToFacebook(content);
          }

        } catch (error) {
          console.error(`❌ Erreur lors de la publication du contenu ${content.id}:`, error.message);
          await this.db.updateScheduledContentStatus(content.id, 'failed', {
            error_message: error.message
          });
        }
      }

    } catch (error) {
      console.error('❌ Erreur lors de la vérification du contenu programmé:', error.message);
    }
  }

  /**
   * Publier sur Instagram
   */
  async publishToInstagram(content) {
    const instagramId = content.account_id.replace('ig_', '');
    const igAccount = await this.db.getInstagramAccountById(instagramId);

    if (!igAccount) {
      throw new Error(`Compte Instagram ${instagramId} non trouvé`);
    }

    const accessToken = igAccount.access_token;

    // Étape 1: Créer le container selon le type de contenu
    console.log(`📸 Création du container Instagram (${content.content_type})...`);

    let containerResponse;
    const containerParams = {
      access_token: accessToken
    };

    if (content.caption) {
      containerParams.caption = content.caption;
    }

    if (content.content_type === 'post') {
      // Post classique (image ou vidéo)
      if (content.media_type === 'image') {
        containerParams.image_url = content.media_url;
      } else if (content.media_type === 'video') {
        containerParams.media_type = 'REELS'; // Les vidéos sont maintenant des reels
        containerParams.video_url = content.media_url;
      }

      containerResponse = await axios.post(
        `https://graph.instagram.com/${instagramId}/media`,
        null,
        { params: containerParams }
      );

    } else if (content.content_type === 'story') {
      // Story
      containerParams.media_type = 'STORIES';

      if (content.media_type === 'image') {
        containerParams.image_url = content.media_url;
      } else if (content.media_type === 'video') {
        containerParams.video_url = content.media_url;
      }

      containerResponse = await axios.post(
        `https://graph.instagram.com/${instagramId}/media`,
        null,
        { params: containerParams }
      );

    } else if (content.content_type === 'reel') {
      // Reel
      containerParams.media_type = 'REELS';
      containerParams.video_url = content.media_url;
      containerParams.share_to_feed = true; // Partager aussi dans le feed

      containerResponse = await axios.post(
        `https://graph.instagram.com/${instagramId}/media`,
        null,
        { params: containerParams }
      );
    }

    const containerId = containerResponse.data.id;
    console.log(`✅ Container créé: ${containerId}`);

    // Sauvegarder le container ID
    await this.db.updateScheduledContentStatus(content.id, 'publishing', {
      container_id: containerId
    });

    // Étape 2: Vérifier le statut du container (polling)
    await this.waitForContainerReady(instagramId, containerId, accessToken);

    // Étape 3: Publier le container
    console.log(`📤 Publication du container ${containerId}...`);
    const publishResponse = await axios.post(
      `https://graph.instagram.com/${instagramId}/media_publish`,
      null,
      {
        params: {
          creation_id: containerId,
          access_token: accessToken
        }
      }
    );

    const publishedId = publishResponse.data.id;
    console.log(`✅ Contenu publié sur Instagram: ${publishedId}`);

    // Marquer comme publié
    await this.db.updateScheduledContentStatus(content.id, 'published', {
      published_id: publishedId
    });
  }

  /**
   * Attendre que le container soit prêt (status = FINISHED)
   */
  async waitForContainerReady(instagramId, containerId, accessToken, maxAttempts = 20) {
    let attempts = 0;

    while (attempts < maxAttempts) {
      const statusResponse = await axios.get(
        `https://graph.instagram.com/${containerId}`,
        {
          params: {
            fields: 'status_code',
            access_token: accessToken
          }
        }
      );

      const statusCode = statusResponse.data.status_code;

      if (statusCode === 'FINISHED') {
        console.log(`✅ Container ${containerId} prêt (FINISHED)`);
        return;
      } else if (statusCode === 'ERROR') {
        throw new Error(`Le container ${containerId} est en erreur`);
      }

      console.log(`⏳ Container ${containerId} en cours de traitement (${statusCode})... tentative ${attempts + 1}/${maxAttempts}`);

      // Attendre 3 secondes avant la prochaine vérification
      await new Promise(resolve => setTimeout(resolve, 3000));
      attempts++;
    }

    throw new Error(`Timeout: Le container ${containerId} n'est pas prêt après ${maxAttempts} tentatives`);
  }

  /**
   * Publier sur Facebook
   */
  async publishToFacebook(content) {
    // Récupérer l'utilisateur et son token
    const user = await new Promise((resolve, reject) => {
      this.db.db.get('SELECT * FROM users WHERE id = ?', [content.user_id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      throw new Error(`Utilisateur ${content.user_id} non trouvé`);
    }

    const pages = JSON.parse(user.pages || '[]');
    const page = pages.find(p => p.id === content.account_id);

    if (!page) {
      throw new Error(`Page Facebook ${content.account_id} non trouvée`);
    }

    const pageAccessToken = page.access_token;

    if (content.content_type === 'post') {
      // Post Facebook
      let publishResponse;

      if (content.media_type === 'image') {
        // Post avec image
        publishResponse = await axios.post(
          `https://graph.facebook.com/v18.0/${content.account_id}/photos`,
          {
            url: content.media_url,
            caption: content.caption || '',
            access_token: pageAccessToken
          }
        );

      } else if (content.media_type === 'video') {
        // Post avec vidéo
        publishResponse = await axios.post(
          `https://graph.facebook.com/v18.0/${content.account_id}/videos`,
          {
            file_url: content.media_url,
            description: content.caption || '',
            access_token: pageAccessToken
          }
        );

      } else {
        // Post texte simple
        publishResponse = await axios.post(
          `https://graph.facebook.com/v18.0/${content.account_id}/feed`,
          {
            message: content.caption || '',
            access_token: pageAccessToken
          }
        );
      }

      const publishedId = publishResponse.data.id || publishResponse.data.post_id;
      console.log(`✅ Contenu publié sur Facebook: ${publishedId}`);

      // Marquer comme publié
      await this.db.updateScheduledContentStatus(content.id, 'published', {
        published_id: publishedId
      });

    } else if (content.content_type === 'story') {
      // Story Facebook (nouvelle fonctionnalité)
      const storyResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${content.account_id}/photo_stories`,
        {
          url: content.media_url,
          access_token: pageAccessToken
        }
      );

      const publishedId = storyResponse.data.id;
      console.log(`✅ Story publiée sur Facebook: ${publishedId}`);

      await this.db.updateScheduledContentStatus(content.id, 'published', {
        published_id: publishedId
      });
    }
  }

  /**
   * Publier immédiatement (sans programmation)
   */
  async publishNow(contentData) {
    // Créer le contenu avec un scheduled_time immédiat
    const content = {
      ...contentData,
      scheduled_time: new Date().toISOString()
    };

    const result = await this.db.createScheduledContent(content);
    const savedContent = await this.db.getScheduledContentById(result.id);

    // Publier immédiatement
    if (savedContent.account_type === 'instagram') {
      await this.publishToInstagram(savedContent);
    } else if (savedContent.account_type === 'facebook') {
      await this.publishToFacebook(savedContent);
    }

    return savedContent;
  }

  /**
   * Obtenir le statut du système
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
      intervalInSeconds: this.checkInterval / 1000
    };
  }
}

module.exports = ContentPublisher;
