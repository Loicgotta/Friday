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

      console.log(`🔍 Vérification des commentaires pour ${activeConfigs.length} configuration(s)...`);

      for (const config of activeConfigs) {
        // Vérifier si c'est une page Facebook ou un compte Instagram
        if (config.page_id.startsWith('ig_')) {
          // C'est un compte Instagram (on préfixe les IDs Instagram avec 'ig_')
          await this.checkInstagramComments(config);
        } else {
          // C'est une page Facebook
          await this.checkPageComments(config);
        }
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
   * Vérifier les commentaires pour un compte Instagram
   */
  async checkInstagramComments(config) {
    try {
      // Extraire l'ID Instagram réel (enlever le préfixe 'ig_')
      const instagramId = config.page_id.replace('ig_', '');

      // Récupérer le compte Instagram de la base de données
      const igAccount = await this.db.getInstagramAccountById(instagramId);

      if (!igAccount) {
        console.log(`⚠️  Compte Instagram ${instagramId} non trouvé`);
        return;
      }

      console.log(`📷 Vérification des commentaires Instagram pour @${igAccount.username}`);

      // Récupérer les posts récents du compte Instagram
      const mediaResponse = await axios.get(
        `https://graph.instagram.com/${instagramId}/media`,
        {
          params: {
            fields: 'id,caption,media_type,media_url,timestamp,comments_count',
            limit: 10, // Les 10 derniers posts
            access_token: igAccount.access_token
          }
        }
      );

      const mediaPosts = mediaResponse.data.data || [];

      // Pour chaque post, vérifier les nouveaux commentaires
      for (const media of mediaPosts) {
        await this.checkInstagramMediaComments(media, config, igAccount.access_token, igAccount.user_id, instagramId);
      }

    } catch (error) {
      console.error(`❌ Erreur pour Instagram ${config.page_id}:`, error.response?.data || error.message);
    }
  }

  /**
   * Vérifier les commentaires d'un média Instagram
   */
  async checkInstagramMediaComments(media, config, accessToken, userId, instagramId) {
    try {
      // Récupérer d'abord les infos du compte Instagram pour éviter de répondre à nos propres commentaires
      const accountInfo = await axios.get(
        `https://graph.instagram.com/${instagramId}`,
        {
          params: {
            fields: 'username',
            access_token: accessToken
          }
        }
      );

      const ourUsername = accountInfo.data.username;

      // Récupérer les commentaires du média
      const commentsResponse = await axios.get(
        `https://graph.instagram.com/${media.id}/comments`,
        {
          params: {
            fields: 'id,from,text,timestamp,username',
            access_token: accessToken
          }
        }
      );

      const comments = commentsResponse.data.data || [];

      for (const comment of comments) {
        // ⚠️ IMPORTANT: Ne JAMAIS répondre à nos propres commentaires
        if (comment.username === ourUsername) {
          console.log(`⏭️  Ignorer notre propre commentaire: "${comment.text}"`);
          continue;
        }

        // Vérifier si ce commentaire a déjà été traité
        const alreadyProcessed = await this.db.isCommentProcessed(comment.id);

        if (!alreadyProcessed && config.auto_reply_enabled) {
          // Attendre le délai configuré si nécessaire
          if (config.reply_delay_minutes > 0) {
            const commentTime = new Date(comment.timestamp);
            const now = new Date();
            const minutesSinceComment = (now - commentTime) / 1000 / 60;

            if (minutesSinceComment < config.reply_delay_minutes) {
              continue; // Pas encore temps de répondre
            }
          }

          // Marquer IMMÉDIATEMENT comme traité pour éviter les doublons (avant de poster)
          await this.db.markCommentAsProcessed(
            comment.id,
            media.id,
            `ig_${instagramId}`,
            userId,
            '[En cours de traitement...]'
          );

          // Générer et poster la réponse sur Instagram
          await this.replyToInstagramComment(comment, media, config, accessToken, userId, instagramId);
        }
      }

    } catch (error) {
      console.error(`❌ Erreur pour le média Instagram ${media.id}:`, error.response?.data || error.message);
    }
  }

  /**
   * Répondre à un commentaire Instagram
   */
  async replyToInstagramComment(comment, media, config, accessToken, userId, instagramId) {
    try {
      // Générer la réponse basée sur le prompt configuré
      const replyText = await this.generateReply(comment.text, config);

      // Poster la réponse sur Instagram
      const response = await axios.post(
        `https://graph.instagram.com/${media.id}/comments`,
        {
          message: replyText
        },
        {
          params: {
            access_token: accessToken
          }
        }
      );

      // Marquer le commentaire comme traité
      await this.db.markCommentAsProcessed(
        comment.id,
        media.id,
        `ig_${instagramId}`,
        userId,
        replyText
      );

      console.log(`✅ Réponse postée sur Instagram - commentaire ${comment.id}`);
      console.log(`   Commentaire: "${comment.text}" par @${comment.username}`);
      console.log(`   Réponse: "${replyText}"`);

    } catch (error) {
      console.error(`❌ Erreur lors de la réponse au commentaire Instagram ${comment.id}:`, error.response?.data || error.message);
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
        // ⚠️ IMPORTANT: Ne JAMAIS répondre à nos propres commentaires (commentaires de la Page)
        if (comment.from && comment.from.id === config.page_id) {
          console.log(`⏭️  Ignorer notre propre commentaire: "${comment.message}"`);
          continue;
        }

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

          // Marquer IMMÉDIATEMENT comme traité pour éviter les doublons (avant de poster)
          await this.db.markCommentAsProcessed(
            comment.id,
            post.id,
            config.page_id,
            userId,
            '[En cours de traitement...]'
          );

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
        friendly: 'Sois chaleureux, amical et accueillant. Utilise un ton bienveillant qui met les gens à l\'aise.',
        professional: 'Sois professionnel, courtois et formel. Maintiens un niveau d\'expertise élevé.',
        casual: 'Sois décontracté, relaxé et informel. Tu peux utiliser des emojis occasionnellement.',
        motivating: 'Sois enthousiaste, encourageant et motivant. Inspire l\'action et la confiance.'
      };

      // Prompt système par défaut si pas de prompt personnalisé
      const defaultPrompt = `Tu es Friday Community Manager, l'agent IA chargé de répondre aux commentaires sur les réseaux sociaux.
Ton rôle : répondre avec chaleur, professionnalisme, bonne humeur, tout en donnant envie aux utilisateurs de découvrir ou tester Friday.

⸻

🎯 Tes objectifs
1. Répondre à tous les commentaires, même vagues, confus, négatifs ou enthousiastes.
2. Toujours représenter Friday avec une voix bienveillante, positive et accessible.
3. Inviter subtilement les gens à tester Friday ou poser leurs questions.
4. Clarifier ce que Friday fait : une équipe d'agents IA spécialisés (marketing, juridique, prospection, organisation…).
5. Transformer les curieux en testeurs.

⸻

🗣️ Ton style
• Chaleureux, encourageant, jamais froid.
• Réponses courtes, humaines, naturelles : ça doit ressembler à un CM humain.
• Ajoute des emojis avec parcimonie (1 ou 2 maximum).
• Toujours poli, jamais agressif, même face aux critiques.
• Tu tutoies si le commentaire tutoie, sinon tu vouvoies.
• Pas de langage trop technique.

⸻

🧩 Comment analyser un commentaire et répondre

1. Si c'est un commentaire enthousiaste
→ Remercie chaleureusement
→ Confirme leur intuition
→ Invite à tester

Ex. « Merci beaucoup ! ❤️ Friday est là pour simplifier votre quotidien, vous pouvez tester quand vous voulez. »

⸻

2. Si c'est une question sur le fonctionnement
→ Explique simplement
→ Encourage à essayer

Ex. « Super question ! Friday fonctionne avec une équipe d'agents IA spécialisés qui vous aident au quotidien. Vous pouvez tester gratuitement pour voir comment ça marche 😊 »

⸻

3. Si c'est un commentaire sceptique / critique
→ Reste calme
→ Rassure
→ Propose d'essayer pour se faire une idée

Ex. « Je comprends totalement ! Friday a justement été pensé pour être simple et vraiment utile au quotidien. Le mieux est d'essayer une petite fonctionnalité pour voir si ça vous aide 😊 »

⸻

4. Si c'est un commentaire confus / vague
→ Clarifie
→ Oriente
→ Propose de tester ou de poser une question

Ex. « Merci pour votre message ! Tu parlais d'un besoin précis ? Je peux t'aider ou te montrer comment Friday fonctionne 😊 »

⸻

5. Si c'est un compliment
→ Remercie
→ Renforce l'image
→ Invite encore discrètement

Ex. « Merci beaucoup pour ton soutien ! 🙌 Tu peux tester Friday si tu veux voir tout ce qu'il peut faire pour toi. »

⸻

6. Si c'est un troll
→ Jamais agressif
→ Réponse courte, calme
→ Redirige poliment

Ex. « Merci pour ton passage ! Si tu veux en savoir plus ou tester Friday, je suis là 😊 »

⸻

🔥 Phrases que tu peux utiliser régulièrement
• « N'hésite pas à tester Friday pour voir ce que ça peut changer dans ton quotidien ! »
• « Je suis là si tu veux découvrir les fonctionnalités ! »
• « Friday rend l'organisation tellement plus simple. Tu peux essayer quand tu veux 😊 »
• « Si tu as une question, j'y réponds avec plaisir ! »

⸻

🧠 Rappel sur Friday (à réutiliser dans les réponses)

Friday, c'est une équipe d'agents IA spécialisés pour simplifier votre quotidien :
• organisation & rappels
• marketing & communication
• juridique OHADA
• prospection & business
• analyse & automatisation
C'est la 1ère équipe ivoirienne entièrement composée d'employés IA et ils servent les PMEs`;

      const finalPrompt = config.prompt && config.prompt.trim() !== '' ? config.prompt : defaultPrompt;

      // Log pour debug
      console.log(`📝 Commentaire reçu: "${commentMessage}"`);

      // Appeler OpenAI pour générer la réponse
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Modèle corrigé - gpt-4.1-mini n'existe pas !
        messages: [
          {
            role: 'system',
            content: `${finalPrompt}

Ton: ${toneInstructions[config.tone] || toneInstructions.motivating}
Langue: ${config.language === 'fr' ? 'Français' : config.language === 'en' ? 'English' : 'Español'}

INSTRUCTIONS CRITIQUES :
- LIS LE COMMENTAIRE CI-DESSOUS ATTENTIVEMENT
- IDENTIFIE son type et réponds selon la stratégie appropriée
- PERSONNALISE ta réponse selon son contenu EXACT
- NE RÉPONDS JAMAIS "Merci pour votre commentaire" de façon générique
- Chaque commentaire est DIFFÉRENT, ta réponse doit être UNIQUE
- 1 à 3 phrases max, pas de signature`
          },
          {
            role: 'user',
            content: `Voici le commentaire auquel tu dois répondre en tant que Friday Community Manager :

"${commentMessage}"

Analyse ce commentaire et réponds de manière personnalisée et pertinente.`
          }
        ],
        temperature: 0.9, // Augmenté pour maximum de créativité
        max_tokens: 200,
        presence_penalty: 0.7, // Augmenté pour forcer la diversité
        frequency_penalty: 0.5 // Augmenté pour éviter les répétitions
      });

      const reply = completion.choices[0].message.content.trim();

      console.log(`📝 Commentaire analysé: "${commentMessage}"`);
      console.log(`💬 Réponse générée: "${reply}"`);
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
