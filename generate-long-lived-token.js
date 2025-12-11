const axios = require('axios');

// INSTRUCTIONS:
// 1. Allez sur https://developers.facebook.com/tools/explorer/
// 2. Générez un token court (short-lived) avec ces permissions:
//    - instagram_basic
//    - instagram_manage_comments
//    - pages_read_engagement
// 3. Remplacez SHORT_LIVED_TOKEN ci-dessous par ce token
// 4. Remplacez APP_ID et APP_SECRET par vos identifiants d'app Facebook

const SHORT_LIVED_TOKEN = 'VOTRE_TOKEN_ICI';
const APP_ID = 'VOTRE_APP_ID';
const APP_SECRET = 'VOTRE_APP_SECRET';

async function generateLongLivedToken() {
    try {
        console.log('🔄 Conversion du token court en token longue durée...\n');

        const response = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
            params: {
                grant_type: 'fb_exchange_token',
                client_id: APP_ID,
                client_secret: APP_SECRET,
                fb_exchange_token: SHORT_LIVED_TOKEN
            }
        });

        console.log('✅ Token longue durée généré avec succès!\n');
        console.log('📋 Nouveau token (valable 60 jours):');
        console.log(response.data.access_token);
        console.log('\n⏰ Expire dans:', response.data.expires_in, 'secondes');
        console.log('📅 Soit environ', Math.round(response.data.expires_in / 86400), 'jours');
        console.log('\n💡 Utilisez ce token dans votre application');

    } catch (error) {
        console.error('❌ Erreur lors de la génération du token:');
        if (error.response) {
            console.error(JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
    }
}

generateLongLivedToken();
