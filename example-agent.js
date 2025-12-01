/**
 * Exemple d'utilisation de l'API pour l'agent IA
 *
 * Ce fichier montre comment l'agent IA peut interagir avec l'API
 * pour récupérer les tokens d'accès et gérer les publicités Facebook/Instagram
 */

const axios = require('axios');

// URL de base de votre serveur OAuth
const BASE_URL = 'http://localhost:3000';

/**
 * Classe principale pour l'agent IA
 */
class FacebookAIAgent {
  constructor(baseUrl = BASE_URL) {
    this.baseUrl = baseUrl;
    this.users = [];
  }

  /**
   * Récupérer tous les utilisateurs connectés
   */
  async fetchConnectedUsers() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/users`);
      this.users = response.data;
      console.log(`✅ ${this.users.length} utilisateur(s) connecté(s)`);
      return this.users;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des utilisateurs:', error.message);
      throw error;
    }
  }

  /**
   * Obtenir un utilisateur spécifique par son Facebook ID
   */
  getUserByFacebookId(facebookId) {
    return this.users.find(u => u.facebook_id === facebookId);
  }

  /**
   * Vérifier si un token est encore valide
   */
  isTokenValid(user) {
    const expiresAt = new Date(user.expires_at);
    const now = new Date();
    return expiresAt > now;
  }

  /**
   * Récupérer les informations d'un compte publicitaire
   */
  async getAdAccountInfo(user, adAccountId) {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/v18.0/${adAccountId}`,
        {
          params: {
            fields: 'id,name,account_id,account_status,currency,balance,insights',
            access_token: user.access_token
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération du compte pub:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Récupérer les campagnes d'un compte publicitaire
   */
  async getCampaigns(user, adAccountId) {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/v18.0/${adAccountId}/campaigns`,
        {
          params: {
            fields: 'id,name,status,objective,insights{spend,impressions,clicks,ctr}',
            access_token: user.access_token
          }
        }
      );
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des campagnes:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Créer une campagne publicitaire
   */
  async createCampaign(user, adAccountId, campaignData) {
    try {
      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${adAccountId}/campaigns`,
        {
          name: campaignData.name,
          objective: campaignData.objective || 'OUTCOME_TRAFFIC',
          status: campaignData.status || 'PAUSED',
          special_ad_categories: campaignData.special_ad_categories || []
        },
        {
          params: {
            access_token: user.access_token
          }
        }
      );
      console.log('✅ Campagne créée:', response.data.id);
      return response.data;
    } catch (error) {
      console.error('❌ Erreur lors de la création de la campagne:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Publier un post sur une Page Facebook
   */
  async publishPagePost(user, pageId, message, imageUrl = null) {
    try {
      const page = user.pages.find(p => p.id === pageId);
      if (!page) {
        throw new Error('Page non trouvée');
      }

      const postData = {
        message: message,
        access_token: page.access_token
      };

      if (imageUrl) {
        postData.url = imageUrl;
      }

      const endpoint = imageUrl
        ? `https://graph.facebook.com/v18.0/${pageId}/photos`
        : `https://graph.facebook.com/v18.0/${pageId}/feed`;

      const response = await axios.post(endpoint, postData);
      console.log('✅ Post publié:', response.data.id);
      return response.data;
    } catch (error) {
      console.error('❌ Erreur lors de la publication:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Récupérer les insights d'une page
   */
  async getPageInsights(user, pageId, metrics = ['page_views', 'page_engaged_users']) {
    try {
      const page = user.pages.find(p => p.id === pageId);
      if (!page) {
        throw new Error('Page non trouvée');
      }

      const response = await axios.get(
        `https://graph.facebook.com/v18.0/${pageId}/insights`,
        {
          params: {
            metric: metrics.join(','),
            period: 'day',
            access_token: page.access_token
          }
        }
      );
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des insights:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Récupérer les leads d'un formulaire
   */
  async getLeads(user, formId) {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/v18.0/${formId}/leads`,
        {
          params: {
            access_token: user.access_token
          }
        }
      );
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des leads:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Publier une story Instagram
   */
  async publishInstagramStory(user, instagramAccountId, imageUrl) {
    try {
      // Étape 1: Uploader la photo
      const uploadResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${instagramAccountId}/media`,
        {
          image_url: imageUrl,
          media_type: 'STORIES',
          access_token: user.access_token
        }
      );

      const creationId = uploadResponse.data.id;

      // Étape 2: Publier la story
      const publishResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${instagramAccountId}/media_publish`,
        {
          creation_id: creationId,
          access_token: user.access_token
        }
      );

      console.log('✅ Story Instagram publiée:', publishResponse.data.id);
      return publishResponse.data;
    } catch (error) {
      console.error('❌ Erreur lors de la publication de la story:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Afficher un résumé de tous les utilisateurs connectés
   */
  displayUsersSummary() {
    console.log('\n📊 RÉSUMÉ DES UTILISATEURS CONNECTÉS\n');
    console.log('='.repeat(60));

    this.users.forEach((user, index) => {
      console.log(`\n👤 Utilisateur ${index + 1}:`);
      console.log(`   Nom: ${user.name}`);
      console.log(`   Email: ${user.email || 'Non fourni'}`);
      console.log(`   Facebook ID: ${user.facebook_id}`);
      console.log(`   Token valide: ${this.isTokenValid(user) ? '✅' : '❌'}`);
      console.log(`   Expire le: ${new Date(user.expires_at).toLocaleString('fr-FR')}`);
      console.log(`   Pages: ${user.pages.length}`);
      console.log(`   Comptes publicitaires: ${user.ad_accounts.length}`);
      console.log(`   Permissions: ${user.permissions.length}`);

      if (user.pages.length > 0) {
        console.log('\n   📄 Pages:');
        user.pages.forEach(page => {
          console.log(`      - ${page.name} (ID: ${page.id})`);
        });
      }

      if (user.ad_accounts.length > 0) {
        console.log('\n   💰 Comptes publicitaires:');
        user.ad_accounts.forEach(acc => {
          console.log(`      - ${acc.name || acc.account_id} (${acc.account_status})`);
        });
      }
    });

    console.log('\n' + '='.repeat(60) + '\n');
  }
}

/**
 * Exemple d'utilisation
 */
async function main() {
  console.log('🤖 Démarrage de l\'agent IA Facebook...\n');

  const agent = new FacebookAIAgent();

  try {
    // 1. Récupérer tous les utilisateurs connectés
    await agent.fetchConnectedUsers();

    if (agent.users.length === 0) {
      console.log('⚠️  Aucun utilisateur connecté. Allez sur http://localhost:3000 pour vous connecter.');
      return;
    }

    // 2. Afficher le résumé
    agent.displayUsersSummary();

    // 3. Exemple: Récupérer les campagnes du premier utilisateur
    const user = agent.users[0];

    if (!agent.isTokenValid(user)) {
      console.log('⚠️  Le token de l\'utilisateur a expiré');
      return;
    }

    if (user.ad_accounts.length > 0) {
      const adAccountId = user.ad_accounts[0].id;
      console.log(`\n📊 Récupération des campagnes du compte ${adAccountId}...\n`);

      const campaigns = await agent.getCampaigns(user, adAccountId);
      console.log(`✅ ${campaigns.length} campagne(s) trouvée(s):`);
      campaigns.forEach(campaign => {
        console.log(`   - ${campaign.name} (${campaign.status})`);
      });
    }

    // 4. Exemple: Récupérer les insights d'une page
    if (user.pages.length > 0) {
      const pageId = user.pages[0].id;
      console.log(`\n📈 Récupération des insights de la page ${user.pages[0].name}...\n`);

      const insights = await agent.getPageInsights(user, pageId);
      console.log('✅ Insights récupérés:', insights);
    }

    console.log('\n✅ Exemple terminé avec succès!\n');

  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
  }
}

// Exécuter l'exemple si le fichier est lancé directement
if (require.main === module) {
  main();
}

// Exporter la classe pour utilisation dans d'autres fichiers
module.exports = FacebookAIAgent;
