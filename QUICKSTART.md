# 🚀 Guide de Démarrage Rapide

## Configuration en 5 minutes

### 1️⃣ Installer les dépendances

```bash
npm install
```

### 2️⃣ Configurer votre app Meta

**IMPORTANT**: Avant de démarrer le serveur, vous DEVEZ configurer votre app sur Meta for Developers:

1. Allez sur https://developers.facebook.com/apps/1364606882072627/settings/basic/

2. **Ajoutez l'URL de redirection OAuth:**
   - Cliquez sur "Products" > "Facebook Login" > "Settings"
   - Dans "Valid OAuth Redirect URIs", ajoutez:
     ```
     http://localhost:3000/auth/facebook/callback
     ```
   - Cliquez sur "Save Changes"

3. **Ajoutez des testeurs (si en mode développement):**
   - Allez dans "Roles" > "Test Users"
   - Ajoutez des utilisateurs qui pourront tester l'app

### 3️⃣ Démarrer le serveur

```bash
npm start
```

Le serveur démarre sur http://localhost:3000

### 4️⃣ Tester la connexion

1. Ouvrez http://localhost:3000 dans votre navigateur
2. Cliquez sur "Se connecter avec Facebook"
3. Connectez-vous avec un compte testeur
4. Autorisez toutes les permissions demandées
5. Vous serez redirigé vers la page de succès

### 5️⃣ Tester l'agent IA

Dans un nouveau terminal, pendant que le serveur tourne:

```bash
npm run test-agent
```

Cela affichera tous les utilisateurs connectés et leurs informations.

## 🎯 API pour l'agent IA

Récupérer tous les utilisateurs avec leurs tokens:

```bash
curl http://localhost:3000/api/users
```

## ⚠️ Problèmes courants

### Erreur: "URL de redirection non valide"
➡️ Vérifiez que vous avez bien ajouté `http://localhost:3000/auth/facebook/callback` dans les Valid OAuth Redirect URIs

### Erreur: "App not set up: This app is still in development mode"
➡️ Ajoutez votre compte Facebook comme testeur dans "Roles" > "Test Users"

### Erreur: "Invalid OAuth access token"
➡️ Le token a peut-être expiré. Reconnectez-vous via l'interface

## 📚 Utilisation avancée

Voir le fichier `README.md` pour plus de détails sur:
- La structure du projet
- Les endpoints API disponibles
- L'utilisation de l'API Facebook
- Le déploiement en production

## 💡 Exemple de code pour l'agent IA

```javascript
const axios = require('axios');

// Récupérer les utilisateurs
const users = await axios.get('http://localhost:3000/api/users');
const user = users.data[0];

// Utiliser le token pour créer une campagne
const campaign = await axios.post(
  `https://graph.facebook.com/v18.0/${user.ad_accounts[0].id}/campaigns`,
  {
    name: 'Ma Campagne',
    objective: 'OUTCOME_TRAFFIC',
    status: 'PAUSED'
  },
  {
    params: { access_token: user.access_token }
  }
);
```

Consultez `example-agent.js` pour des exemples complets.
