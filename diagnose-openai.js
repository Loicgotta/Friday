const OpenAI = require('openai');

console.log('🔍 DIAGNOSTIC OPENAI\n');
console.log('━'.repeat(60));

// 1. Vérifier la variable d'environnement
console.log('\n1️⃣ Vérification de la variable d\'environnement');
console.log('━'.repeat(60));

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
    console.error('❌ OPENAI_API_KEY n\'est PAS définie');
    console.error('\n💡 Solution:');
    console.error('Sur Render:');
    console.error('  1. Dashboard > Votre service Friday');
    console.error('  2. Environment (menu gauche)');
    console.error('  3. Ajoutez: OPENAI_API_KEY = sk-...');
    console.error('  4. Save Changes');
    process.exit(1);
}

console.log('✅ OPENAI_API_KEY est définie');
console.log('   Format:', apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 10));
console.log('   Longueur:', apiKey.length, 'caractères');

// Validation du format
if (!apiKey.startsWith('sk-')) {
    console.warn('⚠️  La clé ne commence pas par "sk-" (format inhabituel)');
}

if (apiKey.includes(' ')) {
    console.error('❌ La clé contient des espaces (invalide)');
    console.error('💡 Supprimez tous les espaces de votre clé API');
    process.exit(1);
}

if (apiKey.length < 40) {
    console.error('❌ La clé est trop courte (probablement invalide)');
    console.error('💡 Les clés OpenAI font généralement 51+ caractères');
    process.exit(1);
}

// 2. Tester la connexion OpenAI
console.log('\n2️⃣ Test de connexion à l\'API OpenAI');
console.log('━'.repeat(60));

const openai = new OpenAI({
    apiKey: apiKey
});

async function testConnection() {
    try {
        console.log('📡 Tentative de connexion...');

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'Tu es un assistant de test.'
                },
                {
                    role: 'user',
                    content: 'Réponds juste "OK" si tu reçois ce message.'
                }
            ],
            max_tokens: 10,
            temperature: 0.5
        });

        console.log('✅ CONNEXION RÉUSSIE !');
        console.log('📝 Réponse de l\'API:', completion.choices[0].message.content);
        console.log('🎯 Modèle utilisé:', completion.model);
        console.log('⏱️  Temps de traitement:', completion.usage.total_tokens, 'tokens');

        console.log('\n━'.repeat(60));
        console.log('✅ DIAGNOSTIC COMPLET: Tout fonctionne correctement');
        console.log('━'.repeat(60));
        console.log('\n💡 Votre agent IA devrait fonctionner normalement.');
        console.log('Si vous rencontrez toujours des erreurs, vérifiez:');
        console.log('  - Que le service Render a bien redémarré');
        console.log('  - Les logs complets de Render pour d\'autres erreurs');

    } catch (error) {
        console.error('\n❌ ERREUR DE CONNEXION\n');
        console.error('Message:', error.message);

        if (error.status === 401) {
            console.error('\n🔑 Problème d\'authentification');
            console.error('Cause: Clé API invalide ou révoquée');
            console.error('\n💡 Solution:');
            console.error('  1. Allez sur https://platform.openai.com/api-keys');
            console.error('  2. Créez une NOUVELLE clé API');
            console.error('  3. Remplacez OPENAI_API_KEY dans Render');
            console.error('  4. Redéployez le service');
        } else if (error.status === 429) {
            console.error('\n⏸️  Quota dépassé');
            console.error('Cause: Limites de taux ou quota épuisé');
            console.error('\n💡 Solution:');
            console.error('  1. Vérifiez votre usage: https://platform.openai.com/usage');
            console.error('  2. Ajoutez un mode de paiement si nécessaire');
            console.error('  3. Attendez la réinitialisation du quota');
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            console.error('\n🌐 Problème réseau');
            console.error('Cause: Impossible de joindre les serveurs OpenAI');
            console.error('\n💡 Solution:');
            console.error('  1. Vérifiez la connexion internet de Render');
            console.error('  2. Vérifiez qu\'il n\'y a pas de proxy/firewall');
            console.error('  3. Réessayez dans quelques minutes');
        } else if (error.message.includes('Connection error')) {
            console.error('\n🔌 Erreur de connexion générique');
            console.error('Cause: La clé API est probablement manquante ou mal formatée');
            console.error('\n💡 Solution:');
            console.error('  1. Vérifiez que OPENAI_API_KEY est bien définie dans Render');
            console.error('  2. Supprimez tous les espaces avant/après la clé');
            console.error('  3. Vérifiez que la clé commence bien par "sk-"');
            console.error('  4. Générez une nouvelle clé si nécessaire');
        } else {
            console.error('\n❓ Erreur inconnue');
            console.error('Détails complets:', JSON.stringify(error, null, 2));
        }

        console.error('\n━'.repeat(60));
        console.error('❌ DIAGNOSTIC COMPLET: Problème détecté');
        console.error('━'.repeat(60));

        process.exit(1);
    }
}

testConnection();
