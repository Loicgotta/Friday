# 📡 Documentation API

Cette API permet à l'agent IA d'accéder aux tokens d'accès des utilisateurs qui ont autorisé l'application.

## 🔗 Base URL

```
http://localhost:3000
```

## 🔐 Authentification

### Routes d'authentification utilisateur

#### 1. Initier la connexion Facebook

```http
GET /auth/facebook
```

Redirige l'utilisateur vers Facebook pour l'authentification.

**Réponse**: Redirection vers Facebook

---

#### 2. Callback OAuth

```http
GET /auth/facebook/callback
```

Route de callback après l'authentification Facebook. Ne pas appeler directement.

**Paramètres de requête**:
- `code` (string): Code d'autorisation Facebook
- `error` (string, optionnel): Message d'erreur si refus
- `error_description` (string, optionnel): Description de l'erreur

**Réponse**: Redirection vers `/success.html` ou `/?error=...`

---

#### 3. Déconnexion

```http
GET /auth/logout
```

Déconnecte l'utilisateur et détruit la session.

**Réponse**: Redirection vers `/`

---

## 👤 Routes API Utilisateur

#### 4. Vérifier le statut de connexion

```http
GET /api/status
```

Vérifie si l'utilisateur est connecté.

**Réponse**:
```json
{
  "authenticated": true,
  "userId": "123456789",
  "userName": "John Doe"
}
```

ou

```json
{
  "authenticated": false
}
```

---

#### 5. Obtenir les informations de l'utilisateur connecté

```http
GET /api/user
```

Récupère les informations de l'utilisateur actuellement connecté (via session).

**Authentification**: Requiert une session active

**Réponse**:
```json
{
  "id": 1,
  "facebook_id": "123456789",
  "name": "John Doe",
  "email": "john@example.com",
  "expires_at": "2025-03-01T12:00:00.000Z",
  "permissions": [
    "ads_management",
    "pages_manage_ads",
    "instagram_basic",
    "..."
  ],
  "pages": [
    {
      "id": "page123",
      "name": "Ma Page Facebook",
      "access_token": "EAAxxxxx..."
    }
  ],
  "ad_accounts": [
    {
      "id": "act_123456",
      "name": "Mon Compte Publicitaire",
      "account_id": "123456",
      "account_status": "ACTIVE"
    }
  ],
  "created_at": "2025-01-15T10:30:00.000Z",
  "updated_at": "2025-01-15T10:30:00.000Z"
}
```

**Note**: Le `access_token` principal n'est PAS retourné pour des raisons de sécurité. Utilisez `/api/users` pour l'agent IA.

---

#### 6. Révoquer l'accès

```http
POST /api/revoke
```

Révoque l'accès de l'utilisateur connecté et supprime ses données.

**Authentification**: Requiert une session active

**Réponse**:
```json
{
  "success": true,
  "message": "Accès révoqué avec succès"
}
```

**Erreurs**:
- `401`: Non authentifié
- `404`: Utilisateur non trouvé
- `500`: Erreur serveur

---

## 🤖 Routes API Agent IA

#### 7. Obtenir tous les utilisateurs (PRINCIPAL)

```http
GET /api/users
```

Récupère la liste complète de tous les utilisateurs avec leurs tokens d'accès.

**⚠️ IMPORTANT**: Cette route doit être sécurisée en production!

**Réponse**:
```json
[
  {
    "id": 1,
    "facebook_id": "123456789",
    "name": "John Doe",
    "email": "john@example.com",
    "access_token": "EAAxxxxxxxxxxxxxxxxx",
    "expires_at": "2025-03-01T12:00:00.000Z",
    "permissions": [
      "ads_management",
      "ads_read",
      "business_management",
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_metadata",
      "pages_manage_ads",
      "pages_manage_posts",
      "pages_manage_engagement",
      "instagram_basic",
      "instagram_manage_comments",
      "instagram_manage_messages",
      "instagram_content_publish",
      "leads_retrieval",
      "read_insights",
      "email",
      "public_profile"
    ],
    "pages": [
      {
        "id": "123456789",
        "name": "Ma Page Facebook",
        "access_token": "EAAyyyyyy...",
        "category": "Business",
        "tasks": ["ANALYZE", "ADVERTISE", "MESSAGING", "MODERATE", "CREATE_CONTENT", "MANAGE"]
      }
    ],
    "ad_accounts": [
      {
        "id": "act_123456789",
        "account_id": "123456789",
        "name": "Mon Compte Publicitaire",
        "account_status": "ACTIVE"
      }
    ],
    "created_at": "2025-01-15T10:30:00.000Z",
    "updated_at": "2025-01-15T10:30:00.000Z"
  },
  {
    "id": 2,
    "facebook_id": "987654321",
    "name": "Jane Smith",
    "..."
  }
]
```

---

## 📊 Utilisation des tokens

### Token principal (`access_token`)

Le token principal de l'utilisateur peut être utilisé pour:
- Créer et gérer des campagnes publicitaires
- Récupérer les insights et statistiques
- Gérer les leads
- Accéder aux informations du profil

**Exemple**:
```javascript
const user = users[0];
const response = await axios.get(
  'https://graph.facebook.com/v18.0/me/adaccounts',
  {
    params: {
      access_token: user.access_token
    }
  }
);
```

### Tokens de Page (`pages[].access_token`)

Les tokens de page sont utilisés pour:
- Publier du contenu sur la page
- Gérer les commentaires et messages
- Récupérer les insights de la page
- Gérer les publicités de la page

**Exemple**:
```javascript
const page = user.pages[0];
const response = await axios.post(
  `https://graph.facebook.com/v18.0/${page.id}/feed`,
  {
    message: 'Mon message',
    access_token: page.access_token
  }
);
```

---

## 🛡️ Sécurité

### En production

**CRITIQUE**: La route `/api/users` expose les tokens d'accès. En production, vous DEVEZ:

1. **Ajouter une authentification API**:
```javascript
app.use('/api/users', (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

2. **Utiliser HTTPS uniquement**

3. **Limiter l'accès par IP**:
```javascript
const allowedIPs = ['127.0.0.1', 'IP_DE_VOTRE_AGENT_IA'];
app.use('/api/users', (req, res, next) => {
  const clientIP = req.ip;
  if (!allowedIPs.includes(clientIP)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});
```

4. **Ajouter un rate limiting**:
```javascript
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // max 100 requêtes
});

app.use('/api/', apiLimiter);
```

---

## 📝 Exemples de code

### Exemple 1: Récupérer tous les utilisateurs

```javascript
const axios = require('axios');

async function getUsers() {
  const response = await axios.get('http://localhost:3000/api/users');
  return response.data;
}
```

### Exemple 2: Créer une campagne publicitaire

```javascript
async function createCampaign(user, adAccountId, campaignName) {
  const response = await axios.post(
    `https://graph.facebook.com/v18.0/${adAccountId}/campaigns`,
    {
      name: campaignName,
      objective: 'OUTCOME_TRAFFIC',
      status: 'PAUSED',
      special_ad_categories: []
    },
    {
      params: {
        access_token: user.access_token
      }
    }
  );

  return response.data;
}

// Utilisation
const users = await getUsers();
const user = users[0];
const campaign = await createCampaign(
  user,
  user.ad_accounts[0].id,
  'Ma Super Campagne'
);
```

### Exemple 3: Publier sur une page Facebook

```javascript
async function postToPage(user, message) {
  const page = user.pages[0];

  const response = await axios.post(
    `https://graph.facebook.com/v18.0/${page.id}/feed`,
    {
      message: message,
      access_token: page.access_token
    }
  );

  return response.data;
}

// Utilisation
const users = await getUsers();
const user = users[0];
await postToPage(user, 'Hello from AI Agent!');
```

### Exemple 4: Récupérer les performances d'une campagne

```javascript
async function getCampaignInsights(user, campaignId) {
  const response = await axios.get(
    `https://graph.facebook.com/v18.0/${campaignId}/insights`,
    {
      params: {
        fields: 'impressions,clicks,spend,ctr,cpc,cpm',
        access_token: user.access_token
      }
    }
  );

  return response.data.data[0];
}
```

---

## 🔄 Gestion des erreurs

### Erreurs courantes

#### Token expiré

```json
{
  "error": {
    "message": "Error validating access token: Session has expired",
    "type": "OAuthException",
    "code": 190,
    "error_subcode": 463
  }
}
```

**Solution**: L'utilisateur doit se reconnecter.

#### Permission manquante

```json
{
  "error": {
    "message": "Permissions error",
    "type": "OAuthException",
    "code": 200,
    "fbtrace_id": "..."
  }
}
```

**Solution**: L'utilisateur doit autoriser la permission manquante.

#### Rate limit atteint

```json
{
  "error": {
    "message": "Application request limit reached",
    "type": "OAuthException",
    "code": 4
  }
}
```

**Solution**: Attendez avant de faire une nouvelle requête.

---

## 📚 Ressources

- [Graph API Reference](https://developers.facebook.com/docs/graph-api/)
- [Marketing API](https://developers.facebook.com/docs/marketing-apis/)
- [Pages API](https://developers.facebook.com/docs/pages/)
- [Instagram API](https://developers.facebook.com/docs/instagram-api/)

---

## 💡 Conseils pour l'agent IA

1. **Vérifiez toujours la date d'expiration** du token avant de l'utiliser
2. **Gérez les erreurs gracieusement** et notifiez l'utilisateur si nécessaire
3. **Respectez les rate limits** de Facebook (200 appels/heure par utilisateur en général)
4. **Utilisez les tokens de page** pour les opérations sur les pages
5. **Stockez les résultats** pour éviter des appels API inutiles
