# 🤖 Friday - Agent IA Facebook/Meta OAuth

Système d'authentification OAuth pour permettre aux utilisateurs de donner accès à leurs comptes Meta/Facebook à un agent IA.

## 📋 Fonctionnalités

L'agent IA aura accès aux fonctionnalités suivantes une fois l'utilisateur connecté :

- ✅ Créer et gérer des publicités (Marketing API)
- ✅ Gérer les publicités d'applications (Meta Ads Manager)
- ✅ Gérer les messages et contenus Instagram
- ✅ Mesurer les performances publicitaires (Marketing API)
- ✅ Capturer et gérer les leads publicitaires
- ✅ Gérer tout sur les Pages Facebook

## 🚀 Installation

### 1. Installer les dépendances

```bash
npm install
```

### 2. Configuration de l'application Meta

Avant de démarrer, vous devez configurer votre application Meta for Developers :

1. **Allez sur [Meta for Developers](https://developers.facebook.com/)**

2. **Configurez les paramètres OAuth :**
   - Dans le tableau de bord de votre app, allez dans **Paramètres > De base**
   - Ajoutez l'URL de redirection OAuth valide :
     ```
     http://localhost:3000/auth/facebook/callback
     ```

3. **Activez les produits nécessaires :**
   - Facebook Login
   - Marketing API
   - Instagram API
   - Pages API

4. **Configurez les cas d'usage :**
   - Create & manage ads with Marketing API
   - Create & manage app ads with Meta Ads Manager
   - Manage messaging & content on Instagram
   - Measure ad performance data with Marketing API
   - Capture & manage ad leads with Marketing API
   - Manage everything on your Page

5. **Mode de développement :**
   - Ajoutez des testeurs dans **Rôles > Testeurs** si votre app est en mode développement
   - Pour utiliser en production, soumettez votre app pour révision

### 3. Variables d'environnement

Les credentials sont déjà configurés dans le fichier `.env` :

```env
FACEBOOK_APP_ID=1364606882072627
FACEBOOK_APP_SECRET=c2678977b6377bea89abf2924d4dea64
PORT=3000
CALLBACK_URL=http://localhost:3000/auth/facebook/callback
SESSION_SECRET=votre_secret_session_aleatoire_tres_securise_123456
FRONTEND_URL=http://localhost:3000
```

⚠️ **IMPORTANT** : Changez le `SESSION_SECRET` pour une valeur aléatoire sécurisée en production !

## 🎯 Démarrage

### Mode développement

```bash
npm run dev
```

### Mode production

```bash
npm start
```

Le serveur démarrera sur `http://localhost:3000`

## 📖 Utilisation

### Pour les utilisateurs

1. Ouvrez `http://localhost:3000` dans votre navigateur
2. Cliquez sur "Se connecter avec Facebook"
3. Autorisez les permissions demandées
4. Vous serez redirigé vers la page de succès avec vos informations

### Pour l'agent IA

L'agent IA peut récupérer les tokens d'accès de tous les utilisateurs via l'API :

```bash
GET http://localhost:3000/api/users
```

**Réponse :**
```json
[
  {
    "id": 1,
    "facebook_id": "123456789",
    "name": "John Doe",
    "email": "john@example.com",
    "access_token": "EAAxxxxxxxx...",
    "expires_at": "2025-03-01T12:00:00.000Z",
    "permissions": ["ads_management", "pages_manage_ads", ...],
    "pages": [
      {
        "id": "page123",
        "name": "Ma Page",
        "access_token": "EAAyyyyyy..."
      }
    ],
    "ad_accounts": [
      {
        "id": "act_123456",
        "name": "Mon Compte Pub",
        "account_id": "123456"
      }
    ],
    "created_at": "2025-01-15T10:30:00.000Z",
    "updated_at": "2025-01-15T10:30:00.000Z"
  }
]
```

## 🔑 API Endpoints

### Authentification

- `GET /auth/facebook` - Initier l'authentification Facebook
- `GET /auth/facebook/callback` - Callback OAuth
- `GET /auth/logout` - Déconnexion

### API

- `GET /api/status` - Vérifier le statut de connexion
- `GET /api/user` - Obtenir les infos de l'utilisateur connecté
- `GET /api/users` - Obtenir tous les utilisateurs (pour l'agent IA)
- `POST /api/revoke` - Révoquer l'accès d'un utilisateur

## 📊 Structure du projet

```
Friday/
├── server.js              # Serveur Express principal
├── database.js            # Gestion de la base de données SQLite
├── package.json           # Dépendances du projet
├── .env                   # Configuration (credentials Meta)
├── .gitignore            # Fichiers à ignorer par Git
├── README.md             # Documentation
└── public/               # Interface frontend
    ├── index.html        # Page de connexion
    ├── success.html      # Page de succès
    ├── styles.css        # Styles CSS
    └── script.js         # JavaScript frontend
```

## 🗄️ Base de données

Les données sont stockées dans `users.db` (SQLite) avec la structure suivante :

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  facebook_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  access_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  permissions TEXT,           -- JSON array
  pages TEXT,                 -- JSON array
  ad_accounts TEXT,           -- JSON array
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
)
```

## 🔒 Sécurité

- Les tokens d'accès sont des **long-lived tokens** (60 jours)
- Les sessions sont sécurisées avec un secret
- Les credentials ne sont jamais exposés au frontend
- Les utilisateurs peuvent révoquer l'accès à tout moment

## 🛠️ Gestion des tokens

Les tokens Facebook expirent après 60 jours. Pour vérifier les tokens expirants :

```javascript
const db = new Database();
const expiringUsers = await db.getUsersWithExpiringTokens(7); // 7 jours avant expiration
```

## 🌐 Utilisation de l'API Facebook

Exemple d'utilisation du token pour créer une publicité :

```javascript
const axios = require('axios');

// Récupérer le token d'un utilisateur
const users = await fetch('http://localhost:3000/api/users').then(r => r.json());
const user = users[0];

// Créer une publicité
const response = await axios.post(
  `https://graph.facebook.com/v18.0/${user.ad_accounts[0].id}/ads`,
  {
    name: 'Ma Publicité',
    status: 'PAUSED',
    // ... autres paramètres
  },
  {
    params: {
      access_token: user.access_token
    }
  }
);
```

## 📝 Notes importantes

1. **Mode développement** : Seuls les utilisateurs ajoutés comme testeurs peuvent se connecter
2. **Production** : Soumettez votre app pour révision avant de la rendre publique
3. **HTTPS** : En production, utilisez HTTPS et mettez à jour `CALLBACK_URL`
4. **Webhooks** : Configurez des webhooks pour être notifié des changements

## 🤝 Support

Pour toute question ou problème :
- Consultez la [documentation Meta for Developers](https://developers.facebook.com/docs/)
- Vérifiez que tous les cas d'usage sont bien configurés dans votre app
- Assurez-vous que les testeurs sont ajoutés en mode développement

## 📄 Licence

Ce projet est fourni tel quel pour l'agent IA Friday.
