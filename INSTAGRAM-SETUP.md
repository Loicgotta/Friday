# 📷 Guide de Configuration Instagram Business

## ⚠️ IMPORTANT : Instagram Business Login n'existe PAS comme système séparé

**Instagram Business API est accessible UNIQUEMENT via Facebook Login.** C'est une limitation technique de Meta, pas un choix de design.

## 🎯 Comment ça fonctionne

```
Instagram Business Account
         ↓
    Lié à une Page Facebook (OBLIGATOIRE)
         ↓
    Facebook Login (OAuth)
         ↓
    Votre agent IA a accès à Instagram !
```

## ✅ Prérequis OBLIGATOIRES

Pour que votre agent IA puisse accéder à Instagram, l'utilisateur DOIT avoir :

### 1. Un compte Instagram Business (pas personnel)
- ❌ Compte Instagram Personnel → Ne fonctionne PAS
- ✅ Compte Instagram Business → Fonctionne
- ✅ Compte Instagram Creator → Fonctionne

### 2. Une Page Facebook
- Chaque utilisateur doit avoir une Page Facebook
- Gratuit, prend 2 minutes à créer

### 3. Instagram lié à la Page Facebook
- Le compte Instagram Business doit être connecté à la Page Facebook
- C'est via cette liaison que l'API fonctionne

## 📋 Guide pas à pas pour les utilisateurs

### Étape 1 : Convertir Instagram en Business

Si votre compte Instagram est personnel :

1. **Ouvrez l'app Instagram** sur mobile
2. Allez dans **Paramètres** → **Compte**
3. Cliquez sur **Passer à un compte professionnel**
4. Choisissez **"Entreprise"** (ou "Créateur")
5. Suivez les instructions
6. ✅ Votre compte est maintenant un compte Business

### Étape 2 : Créer une Page Facebook (si nécessaire)

Si vous n'avez pas de Page Facebook :

1. Allez sur https://www.facebook.com/pages/create
2. Choisissez **"Entreprise ou marque"**
3. Entrez le nom de votre page
4. Choisissez une catégorie
5. Cliquez sur **"Créer une page"**
6. ✅ Votre Page Facebook est créée

### Étape 3 : Lier Instagram à la Page Facebook

**Option A : Via Instagram mobile**

1. Ouvrez **Instagram** → **Paramètres**
2. Allez dans **Compte** → **Page liée**
3. Cliquez sur **"Créer une page"** ou **"Lier une page existante"**
4. Sélectionnez votre Page Facebook
5. Confirmez la liaison
6. ✅ Instagram est maintenant lié à Facebook

**Option B : Via Facebook (sur ordinateur)**

1. Allez sur votre **Page Facebook**
2. Cliquez sur **Paramètres**
3. Dans le menu de gauche, cliquez sur **Instagram**
4. Cliquez sur **"Connecter le compte"**
5. Entrez vos identifiants Instagram
6. ✅ Instagram est maintenant lié à Facebook

### Étape 4 : Se connecter à l'agent IA

1. Allez sur **https://friday-tal7.onrender.com**
2. Cliquez sur **"Se connecter avec Facebook"**
3. Autorisez toutes les permissions demandées
4. ✅ L'agent IA a maintenant accès à votre Instagram !

### Étape 5 : Configurer l'agent

1. Allez sur **https://friday-tal7.onrender.com/agent-config.html**
2. Vous verrez votre Page Facebook avec le compte Instagram associé
3. Exemple d'affichage :
   ```
   📘 Ma Page Facebook
   Facebook ID: 123456789
   📷 Instagram: @mon_compte_insta
   ```
4. Configurez le prompt et activez l'agent
5. ✅ L'agent surveille maintenant Instagram !

## 🔍 Vérifier que tout fonctionne

### Dans l'interface de configuration :

```
✅ Si Instagram est connecté:
   📘 Nom de la Page
   Facebook ID: 123456
   📷 Instagram: @username

❌ Si Instagram n'est PAS connecté:
   📘 Nom de la Page
   Facebook ID: 123456
   📷 Instagram: Non connecté
```

### Comment résoudre "Instagram: Non connecté"

1. Vérifiez que votre Instagram est un compte Business
2. Vérifiez que Instagram est bien lié à votre Page Facebook
3. Déconnectez-vous et reconnectez-vous sur l'agent IA
4. Si ça ne fonctionne toujours pas, déliez puis re-liez Instagram à Facebook

## 🤖 Ce que l'agent IA peut faire sur Instagram

Une fois configuré, l'agent peut :

### ✅ Avec permissions de base (actuelles) :
- Voir les posts Instagram
- Lire les commentaires Instagram
- Obtenir les informations du compte (@username, photo, etc.)

### ✅ Avec permissions avancées (après App Review) :
- **Répondre aux commentaires Instagram** automatiquement
- Analyser le sentiment des commentaires
- Gérer les réponses selon votre prompt

### ❌ Ce que l'agent NE PEUT PAS faire :
- Poster de nouveaux posts Instagram (nécessite `instagram_content_publish`)
- Gérer les messages directs Instagram (nécessite Messenger Platform)
- Modifier le profil Instagram
- Accéder aux stories Instagram

## 📊 Architecture technique

Pour les développeurs :

```javascript
// 1. L'utilisateur se connecte
POST /auth/facebook
  → Demande les permissions : public_profile, pages_show_list, instagram_basic

// 2. Récupération des pages avec Instagram
GET /v18.0/me/accounts?fields=id,name,access_token,instagram_business_account
  → Retourne toutes les pages avec leurs comptes Instagram liés

// 3. Pour chaque page avec Instagram
GET /v18.0/{instagram_account_id}?fields=id,username,name,profile_picture_url
  → Retourne les détails du compte Instagram

// 4. Surveillance des commentaires Instagram
GET /v18.0/{instagram_account_id}/media?fields=id,caption
  → Récupère les posts Instagram

GET /v18.0/{media_id}/comments
  → Récupère les commentaires

POST /v18.0/{comment_id}/replies
  → Répondre à un commentaire (nécessite instagram_manage_comments)
```

## ⚠️ Limitations et exigences

### Permissions requises

| Permission | Status actuel | Nécessaire pour |
|------------|---------------|-----------------|
| `instagram_basic` | ⚠️ Désactivé (App Review requis) | Infos de base Instagram |
| `instagram_manage_comments` | ⚠️ Désactivé (App Review requis) | Répondre aux commentaires |
| `pages_show_list` | ✅ Actif | Lister les pages |
| `pages_read_engagement` | ✅ Actif | Lire l'engagement |

### Pour activer complètement Instagram :

1. Configurez le Use Case "Manage messaging & content on Instagram"
2. Soumettez une App Review à Meta
3. Attendez l'approbation (3-5 jours)
4. Décommentez les permissions Instagram dans `server.js`
5. Redéployez

## ❓ FAQ

### Pourquoi pas de "Instagram Login" direct ?
Meta a choisi de centraliser tout via Facebook Login. Instagram Business API n'a pas de système d'authentification séparé.

### Je n'ai pas de Page Facebook, je dois en créer une ?
Oui, c'est obligatoire. Même si vous utilisez uniquement Instagram, vous devez avoir une Page Facebook pour lier votre compte Instagram Business.

### Mon Instagram est personnel, ça fonctionne ?
Non. Vous devez convertir en compte Business. C'est gratuit et réversible.

### Je peux utiliser Instagram sans Facebook ?
Non, techniquement impossible avec Instagram Business API.

### L'agent peut poster sur Instagram ?
Pas avec les permissions actuelles. Il faudrait `instagram_content_publish` + App Review.

### L'agent peut gérer les messages Instagram ?
Pas directement. Il faudrait intégrer Messenger Platform avec `pages_messaging` + App Review.

### Combien de comptes Instagram je peux gérer ?
Autant que vous voulez ! Chaque Page Facebook peut être liée à un compte Instagram.

## 🆘 Support

Si vous rencontrez des problèmes :

1. **Vérifiez la checklist** ci-dessus
2. **Consultez les logs** sur Render
3. **Déconnectez/reconnectez** votre compte
4. **Vérifiez la liaison** Instagram ↔ Facebook sur https://www.facebook.com/pages

---

**TL;DR** : Il n'y a pas de "Instagram Business Login" séparé. Instagram Business est accessible uniquement via Facebook Login en liant votre compte Instagram Business à une Page Facebook. C'est une limitation technique de Meta.
