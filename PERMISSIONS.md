# 🔑 Guide Complet des Permissions Facebook

Ce fichier explique comment activer progressivement toutes les permissions pour votre agent IA.

## 📋 Permissions actuellement actives (Version de base)

Le code utilise actuellement ces permissions **de base** qui fonctionnent sans configuration avancée:

```javascript
const FACEBOOK_PERMISSIONS = [
  'public_profile',        // ✅ Disponible par défaut
  'ads_management',        // ⚠️ Nécessite Business Verification
  'ads_read',              // ⚠️ Nécessite Business Verification
  'pages_show_list',       // ✅ Disponible par défaut
  'pages_read_engagement', // ✅ Disponible par défaut
  'leads_retrieval'        // ⚠️ Nécessite configuration Use Case
];
```

## 🎯 Permissions complètes (À activer progressivement)

Voici toutes les permissions que vous voulez pour votre agent IA:

### 1️⃣ Permissions de base (déjà actives)
- ✅ `public_profile` - Informations publiques du profil
- ✅ `email` - Adresse email (optionnel, retiré pour éviter les erreurs)

### 2️⃣ Gestion des publicités
- ⚠️ `ads_management` - Créer et gérer des publicités
- ⚠️ `ads_read` - Lire les données des publicités
- ⚠️ `business_management` - Gérer les business managers

**Activation**: Nécessite **Business Verification** sur Meta

### 3️⃣ Gestion des Pages Facebook
- ✅ `pages_show_list` - Lister les pages
- ✅ `pages_read_engagement` - Lire l'engagement
- ⚠️ `pages_manage_metadata` - Gérer les métadonnées
- ⚠️ `pages_manage_ads` - Gérer les publicités de page
- ⚠️ `pages_manage_posts` - Gérer les publications
- ⚠️ `pages_manage_engagement` - Gérer l'engagement

**Activation**: Configure le Use Case "Manage everything on your Page"

### 4️⃣ Instagram
- ⚠️ `instagram_basic` - Accès de base Instagram
- ⚠️ `instagram_manage_comments` - Gérer les commentaires
- ⚠️ `instagram_manage_messages` - Gérer les messages
- ⚠️ `instagram_content_publish` - Publier du contenu

**Activation**: Configure le Use Case "Manage messaging & content on Instagram"

### 5️⃣ Insights et Leads
- ⚠️ `read_insights` - Lire les statistiques
- ⚠️ `leads_retrieval` - Récupérer les leads

**Activation**: Configure les Use Cases correspondants

---

## 🚀 Comment activer TOUTES les permissions

### Étape 1: Activer les Use Cases sur Meta for Developers

1. Allez sur https://developers.facebook.com/apps/1364606882072627/use_cases/

2. Pour chaque cas d'usage, cliquez sur **"Customize"**:

   #### a) **Create & manage ads with Marketing API**
   - Cliquez sur "Customize"
   - Sélectionnez les permissions: `ads_management`, `ads_read`, `business_management`
   - Cliquez sur "Save"

   #### b) **Manage everything on your Page**
   - Cliquez sur "Customize"
   - Sélectionnez toutes les permissions pages:
     - `pages_show_list`
     - `pages_read_engagement`
     - `pages_manage_metadata`
     - `pages_manage_ads`
     - `pages_manage_posts`
     - `pages_manage_engagement`
   - Cliquez sur "Save"

   #### c) **Manage messaging & content on Instagram**
   - Cliquez sur "Customize"
   - Sélectionnez:
     - `instagram_basic`
     - `instagram_manage_comments`
     - `instagram_manage_messages`
     - `instagram_content_publish`
   - Cliquez sur "Save"

   #### d) **Measure ad performance data with Marketing API**
   - Cliquez sur "Customize"
   - Sélectionnez: `read_insights`
   - Cliquez sur "Save"

   #### e) **Capture & manage ad leads with Marketing API**
   - Cliquez sur "Customize"
   - Sélectionnez: `leads_retrieval`
   - Cliquez sur "Save"

3. Une fois tous les Use Cases configurés, attendez quelques minutes pour que les changements prennent effet

### Étape 2: Business Verification (pour les publicités)

Pour utiliser les permissions publicitaires (`ads_management`, etc.), vous devez vérifier votre entreprise:

1. Allez dans **Settings → Business Verification**
2. Suivez le processus de vérification (peut prendre plusieurs jours)
3. Une fois vérifié, les permissions publicitaires seront disponibles

### Étape 3: Mettre à jour le code (une fois les Use Cases activés)

Une fois que tous vos Use Cases sont configurés, mettez à jour `server.js`:

```javascript
// Permissions Facebook requises pour l'agent IA - VERSION COMPLÈTE
const FACEBOOK_PERMISSIONS = [
  // Permissions de base
  'public_profile',
  'email',

  // Gestion des publicités
  'ads_management',
  'ads_read',
  'business_management',

  // Gestion des Pages
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_metadata',
  'pages_manage_ads',
  'pages_manage_posts',
  'pages_manage_engagement',

  // Instagram
  'instagram_basic',
  'instagram_manage_comments',
  'instagram_manage_messages',
  'instagram_content_publish',

  // Leads et insights
  'leads_retrieval',
  'read_insights'
].join(',');
```

### Étape 4: Redéployer sur Render

```bash
git add .
git commit -m "Ajout de toutes les permissions Facebook"
git push
```

Render va automatiquement redéployer avec les nouvelles permissions.

---

## 🧪 Tester progressivement

**Recommandation**: Activez et testez les permissions progressivement:

1. **Démarrez avec la version actuelle** (permissions de base) ✅
2. **Ajoutez les permissions Pages** une fois le Use Case configuré
3. **Ajoutez Instagram** une fois le Use Case configuré
4. **Ajoutez les publicités** une fois la Business Verification terminée

---

## ❌ Résolution des problèmes

### "Invalid Scopes" pour certaines permissions

**Cause**: Le Use Case correspondant n'est pas activé

**Solution**: Activez le Use Case sur Meta for Developers (voir Étape 1)

### "Permissions error" lors de l'utilisation

**Cause**: L'utilisateur n'a pas accordé la permission ou elle n'est pas disponible

**Solution**:
- Vérifiez que le Use Case est approuvé
- En mode développement, seules certaines permissions sont disponibles
- Passez en mode Live pour toutes les permissions

### "Business verification required"

**Cause**: Les permissions publicitaires nécessitent une vérification

**Solution**: Complétez la Business Verification sur Meta

---

## 📝 Mode Développement vs Production

### Mode Développement (actuel)
- Seuls les testeurs peuvent se connecter
- Certaines permissions peuvent être limitées
- Idéal pour tester avant le lancement

### Mode Production
- Tout le monde peut se connecter
- Toutes les permissions approuvées sont disponibles
- Nécessite une révision de l'app par Meta pour certaines permissions

---

## 🔗 Ressources

- [Liste complète des permissions Facebook](https://developers.facebook.com/docs/permissions/reference)
- [Configuration des Use Cases](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/use-cases)
- [Business Verification](https://developers.facebook.com/docs/development/release/business-verification)
