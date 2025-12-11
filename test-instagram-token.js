const axios = require('axios');

const token = 'IGAAf0sbYu5bhBZAFlzUFJvSUFRRXIzSzBIUWFlMFljdWJOYWRqWV9DdkNhWDVDbzUxSHdSbDRDQzlESEphS2szSDFKc2dlNjh6ampWeXp3eS1EaHdhc0JJNFlxd2F6ZADB2b1YzSTdSQVJvQi1uQkQycEh5MEFQX3pKWnR5QUJnMAZDZD';

async function testToken() {
    console.log('🔍 Test du token Instagram...\n');

    try {
        // Test 1: Récupérer les infos du compte
        console.log('📝 Test 1: Récupération des informations du compte');
        const response = await axios.get('https://graph.instagram.com/me', {
            params: {
                fields: 'id,username,name,account_type,media_count',
                access_token: token
            }
        });

        console.log('✅ Token valide!');
        console.log('Informations du compte:');
        console.log(JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.error('❌ Erreur lors du test du token:');

        if (error.response) {
            console.error('\n📋 Détails de l\'erreur:');
            console.error('Status:', error.response.status);
            console.error('Response complète:', JSON.stringify(error.response.data, null, 2));

            if (error.response.data.error) {
                console.error('Message:', error.response.data.error.message);
                console.error('Type:', error.response.data.error.type);
                console.error('Code:', error.response.data.error.code);
                console.error('Fbtrace ID:', error.response.data.error.fbtrace_id);
            }

            console.error('\n🔍 Analyse:');

            if (error.response.data.error) {
                if (error.response.data.error.code === 190) {
                    console.error('Le token a expiré ou a été révoqué.');
                    console.error('Solution: Générez un nouveau token d\'accès depuis:');
                    console.error('- Meta for Developers > Outils > Graph API Explorer');
                    console.error('- Ou via votre application Facebook');
                } else if (error.response.data.error.code === 100) {
                    console.error('Le token est invalide ou malformé.');
                } else if (error.response.data.error.message && error.response.data.error.message.includes('permissions')) {
                    console.error('Permissions manquantes sur le token.');
                    console.error('Permissions requises: instagram_basic, instagram_manage_comments');
                }
            }

        } else if (error.request) {
            console.error('Pas de réponse du serveur Instagram');
            console.error('Vérifiez votre connexion internet');
        } else {
            console.error('Erreur:', error.message);
        }
    }

    try {
        // Test 2: Vérifier les permissions du token
        console.log('\n📝 Test 2: Vérification des permissions');
        const debugResponse = await axios.get('https://graph.facebook.com/debug_token', {
            params: {
                input_token: token,
                access_token: token
            }
        });

        console.log('✅ Informations du token:');
        console.log(JSON.stringify(debugResponse.data, null, 2));

    } catch (error) {
        console.error('❌ Impossible de vérifier les permissions du token');
        if (error.response) {
            console.error('Message:', error.response.data.error.message);
        }
    }
}

testToken();
