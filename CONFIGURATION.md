# 🔧 Configuration de l'Application Meta for Developers

Ce guide détaillé vous explique comment configurer votre application Meta for Developers pour permettre l'authentification OAuth.

## 📱 Étape 1: Accéder à votre application

1. Allez sur https://developers.facebook.com/
2. Connectez-vous avec votre compte Facebook
3. Cliquez sur "My Apps" dans le menu
4. Sélectionnez votre app (ID: 1364606882072627) ou créez-en une nouvelle

## 🔑 Étape 2: Vérifier les paramètres de base

1. Dans le menu de gauche, cliquez sur **"Settings" → "Basic"**
2. Vérifiez que vous avez bien:
   - **App ID**: 1364606882072627
   - **App Secret**: (gardez-le secret!)
3. Notez le **App Display Name** (nom public de votre app)

## 🔐 Étape 3: Configurer Facebook Login (CRITIQUE)

### 3.1 Ajouter le produit Facebook Login

1. Dans le menu de gauche, cliquez sur **"Add Product"** (ou "Products" si déjà ajouté)
2. Trouvez **"Facebook Login"** et cliquez sur **"Set Up"**

### 3.2 Configurer les OAuth Redirect URIs

C'est l'étape la plus importante!

1. Cliquez sur **"Facebook Login" → "Settings"** dans le menu de gauche
2. Trouvez le champ **"Valid OAuth Redirect URIs"**
3. Ajoutez les URLs suivantes:

   **Pour le développement local:**
   ```
   http://localhost:3000/auth/facebook/callback
   ```

   **Pour la production (quand vous déployez):**
   ```
   https://votre-domaine.com/auth/facebook/callback
   ```

4. Cliquez sur **"Save Changes"** en bas de la page

### 3.3 Autres paramètres Facebook Login

- **Login with the JavaScript SDK**: Désactivé (nous utilisons le serveur)
- **Web OAuth Login**: Activé ✅
- **Use Strict Mode for Redirect URIs**: Activé ✅
- **Enforce HTTPS**: Désactivé en développement, Activé en production

## 📊 Étape 4: Configurer les cas d'usage (Use Cases)

Cette étape est ESSENTIELLE pour obtenir les permissions nécessaires.

1. Dans le menu de gauche, cliquez sur **"Use Cases"**
2. Cliquez sur **"Customize"** pour chaque cas d'usage suivant:

### 4.1 Create & manage ads with Marketing API
- **Description**: Permet à l'agent IA de créer et gérer des publicités
- **Permissions requises**:
  - `ads_management`
  - `ads_read`
  - `business_management`

### 4.2 Create & manage app ads with Meta Ads Manager
- **Description**: Gestion des publicités d'applications
- **Permissions requises**:
  - `ads_management`

### 4.3 Manage messaging & content on Instagram
- **Description**: Gestion des messages et contenus Instagram
- **Permissions requises**:
  - `instagram_basic`
  - `instagram_manage_comments`
  - `instagram_manage_messages`
  - `instagram_content_publish`

### 4.4 Measure ad performance data with Marketing API
- **Description**: Mesurer les performances publicitaires
- **Permissions requises**:
  - `read_insights`
  - `ads_read`

### 4.5 Capture & manage ad leads with Marketing API
- **Description**: Capturer et gérer les leads
- **Permissions requises**:
  - `leads_retrieval`

### 4.6 Manage everything on your Page
- **Description**: Gestion complète des Pages Facebook
- **Permissions requises**:
  - `pages_show_list`
  - `pages_read_engagement`
  - `pages_manage_metadata`
  - `pages_manage_ads`
  - `pages_manage_posts`
  - `pages_manage_engagement`

## 👥 Étape 5: Ajouter des testeurs (Mode Développement)

Si votre app est en mode développement, seuls les testeurs peuvent se connecter.

1. Dans le menu de gauche, cliquez sur **"Roles" → "Test Users"**
2. Cliquez sur **"Add Test Users"** ou **"Create Test Users"**
3. Créez au moins un utilisateur de test
4. Notez l'email et le mot de passe du testeur

**OU**

1. Allez dans **"Roles" → "Roles"**
2. Ajoutez des développeurs/testeurs avec leur compte Facebook réel
3. Ces personnes pourront tester l'app même en mode développement

## 🚀 Étape 6: Passer en mode Production (optionnel)

Pour que n'importe qui puisse se connecter:

### 6.1 Préparer l'app pour la révision

1. Complétez tous les détails requis dans **"App Review" → "Permissions and Features"**
2. Pour chaque permission, fournissez:
   - Une description détaillée de l'utilisation
   - Une vidéo de démonstration (si demandée)
   - Des instructions de test

### 6.2 Soumettre pour révision

1. Allez dans **"App Review" → "Permissions and Features"**
2. Cliquez sur **"Request"** pour chaque permission nécessaire
3. Remplissez les formulaires de demande
4. Attendez l'approbation (peut prendre plusieurs jours)

### 6.3 Activer le mode Live

1. Une fois toutes les permissions approuvées
2. Allez dans **"Settings" → "Basic"**
3. En haut de la page, changez le statut de **"Development"** à **"Live"**

## 🔍 Étape 7: Vérifier la configuration

### Checklist finale

- [ ] Facebook Login est ajouté et configuré
- [ ] Valid OAuth Redirect URIs est correctement configuré
- [ ] Tous les cas d'usage sont activés
- [ ] Des testeurs sont ajoutés (mode développement)
- [ ] App ID et App Secret sont dans le fichier .env
- [ ] Le serveur démarre sans erreur avec `npm start`

### Test de connexion

1. Démarrez le serveur: `npm start`
2. Ouvrez http://localhost:3000
3. Cliquez sur "Se connecter avec Facebook"
4. Vous devriez être redirigé vers Facebook
5. Connectez-vous avec un compte testeur
6. Autorisez les permissions
7. Vous devriez être redirigé vers la page de succès

## ❌ Résolution des problèmes courants

### Erreur: "Can't Load URL"

```
Can't Load URL: The domain of this URL isn't included in the app's domains.
```

**Solution**: Ajoutez `localhost` dans **"Settings" → "Basic" → "App Domains"**

### Erreur: "URL Blocked"

```
URL Blocked: This redirect failed because the redirect URI is not whitelisted.
```

**Solution**: Vérifiez que `http://localhost:3000/auth/facebook/callback` est bien dans "Valid OAuth Redirect URIs"

### Erreur: "This app is in Development Mode"

```
Only developers, admins and testers can sign in.
```

**Solution**: Ajoutez votre compte comme testeur dans **"Roles" → "Test Users"** ou **"Roles" → "Roles"**

### Erreur: "Permission Denied"

```
The user denied the permission.
```

**Solution**: L'utilisateur a refusé certaines permissions. Relancez le processus et acceptez toutes les permissions.

### Erreur: "Invalid Scope"

```
Invalid Scopes: [permission_name]. This message is only shown to developers.
```

**Solution**: La permission n'est pas disponible pour votre app. Vérifiez que le cas d'usage est bien configuré et approuvé.

## 📞 Support

Pour plus d'aide:
- Documentation Facebook Login: https://developers.facebook.com/docs/facebook-login/
- Documentation Marketing API: https://developers.facebook.com/docs/marketing-apis/
- Forum des développeurs: https://developers.facebook.com/community/

## 🔄 Mise à jour des permissions

Si vous ajoutez de nouvelles permissions plus tard:

1. Ajoutez-les dans `server.js` dans la constante `FACEBOOK_PERMISSIONS`
2. Configurez le cas d'usage correspondant dans le tableau de bord Meta
3. Demandez la révision si nécessaire (mode production)
4. Les utilisateurs devront se reconnecter pour accorder les nouvelles permissions

---

**Note**: Les permissions et cas d'usage peuvent changer. Consultez toujours la documentation officielle de Meta for Developers pour les informations les plus à jour.
