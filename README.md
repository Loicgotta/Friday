# Friday - Agent IA avec Google Drive et RAG

Agent IA intelligent qui se connecte a votre Google Drive et repond a vos questions sur vos documents en utilisant la methode RAG (Retrieval-Augmented Generation).

## Fonctionnalites

- **Connexion Google Drive** : Acces securise en lecture seule a vos documents
- **Indexation automatique** : Support des PDF, Google Docs, Word, texte, Markdown, CSV, JSON
- **Systeme RAG** : Recherche semantique avec embeddings OpenAI
- **Interface de chat** : Posez vos questions en langage naturel
- **Historique des conversations** : Sauvegarde automatique des echanges

## Deploiement sur Render

### 1. Configuration Google Cloud Console

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Creez un nouveau projet ou selectionnez-en un existant
3. Activez l'API Google Drive :
   - Allez dans "APIs & Services" > "Library"
   - Recherchez "Google Drive API" et activez-la
4. Configurez l'ecran de consentement OAuth :
   - "APIs & Services" > "OAuth consent screen"
   - Choisissez "External" (ou "Internal" pour G Suite)
   - Remplissez les informations requises
   - Ajoutez les scopes : `drive.readonly`, `userinfo.email`, `userinfo.profile`
5. Creez les identifiants OAuth :
   - "APIs & Services" > "Credentials"
   - "Create Credentials" > "OAuth client ID"
   - Type : "Web application"
   - Ajoutez l'URI de redirection : `https://votre-app.onrender.com/auth/google/callback`

### 2. Deploiement sur Render

1. Connectez votre repo GitHub a Render
2. Creez un nouveau "Web Service"
3. Configurez les variables d'environnement :

```
GOOGLE_CLIENT_ID=votre_client_id
GOOGLE_CLIENT_SECRET=votre_client_secret
OPENAI_API_KEY=votre_cle_openai
SESSION_SECRET=une_chaine_aleatoire_longue
BASE_URL=https://votre-app.onrender.com
CALLBACK_URL=https://votre-app.onrender.com/auth/google/callback
NODE_ENV=production
```

4. Build command : `npm install`
5. Start command : `npm start`

### 3. Configuration locale (developpement)

```bash
# Cloner le repo
git clone <repo-url>
cd Friday

# Installer les dependances
npm install

# Creer le fichier .env
cp .env.example .env

# Editer .env avec vos credentials
# GOOGLE_CLIENT_ID=...
# GOOGLE_CLIENT_SECRET=...
# OPENAI_API_KEY=...

# Demarrer en mode developpement
npm run dev
```

## Utilisation

1. **Connexion** : Cliquez sur "Connecter Google Drive" sur la page d'accueil
2. **Autorisation** : Autorisez l'acces en lecture a votre Drive
3. **Synchronisation** : Cliquez sur "Synchroniser Drive" pour indexer vos documents
4. **Chat** : Posez vos questions sur vos documents

### Exemples de questions

- "Resume-moi le contenu de mon document sur le projet X"
- "Quelles sont les deadlines mentionnees dans mes documents ?"
- "Compare les informations entre le rapport A et le rapport B"
- "Trouve les coordonnees de contact dans mes fichiers"

## Architecture

```
Friday/
├── server.js                 # Serveur Express principal
├── database.js               # Gestion SQLite (utilisateurs, conversations)
├── services/
│   ├── googleAuth.js         # Authentification OAuth Google
│   ├── driveService.js       # Acces et lecture Google Drive
│   └── ragService.js         # Indexation et RAG avec OpenAI
├── public/
│   ├── index.html            # Page d'accueil
│   ├── chat.html             # Interface de chat
│   └── styles.css            # Styles
├── render.yaml               # Configuration Render
└── package.json
```

## API Endpoints

### Authentification
- `GET /auth/google` - Demarrer l'authentification Google
- `GET /auth/google/callback` - Callback OAuth
- `GET /auth/logout` - Deconnexion
- `GET /api/status` - Statut de connexion

### Google Drive
- `GET /api/drive/files` - Lister les fichiers
- `GET /api/drive/stats` - Statistiques du Drive
- `POST /api/drive/sync` - Synchroniser et indexer les documents

### Chat
- `GET /api/conversations` - Liste des conversations
- `POST /api/conversations` - Nouvelle conversation
- `DELETE /api/conversations/:id` - Supprimer une conversation
- `GET /api/conversations/:id/messages` - Messages d'une conversation
- `POST /api/chat` - Envoyer un message et obtenir une reponse

### Index
- `GET /api/index/stats` - Statistiques de l'index RAG

## Formats de fichiers supportes

- PDF (`.pdf`)
- Google Docs
- Google Sheets (export CSV)
- Microsoft Word (`.docx`)
- Texte (`.txt`)
- Markdown (`.md`)
- CSV (`.csv`)
- JSON (`.json`)
- HTML (`.html`)

## Securite

- Acces en lecture seule au Google Drive
- Tokens stockes de maniere securisee
- Sessions chiffrees
- Possibilite de revoquer l'acces a tout moment
- Les documents ne sont pas stockes, seuls les embeddings sont conserves en memoire

## Variables d'environnement

| Variable | Description | Requis |
|----------|-------------|--------|
| `GOOGLE_CLIENT_ID` | Client ID Google OAuth | Oui |
| `GOOGLE_CLIENT_SECRET` | Client Secret Google OAuth | Oui |
| `OPENAI_API_KEY` | Cle API OpenAI | Oui |
| `SESSION_SECRET` | Secret pour les sessions | Oui |
| `BASE_URL` | URL de base de l'application | Oui |
| `CALLBACK_URL` | URL de callback OAuth | Oui |
| `PORT` | Port du serveur (defaut: 3000) | Non |
| `NODE_ENV` | Environnement (development/production) | Non |

## Limitations

- L'index RAG est stocke en memoire (se reinitialise au redemarrage)
- Maximum ~1000 documents par utilisateur recommande
- Les fichiers Excel ne sont pas entierement supportes

## Licence

MIT
