# 🤖 Agent IA - Réponses Automatiques aux Commentaires

Ce système permet à votre agent IA de surveiller et répondre automatiquement aux commentaires sur vos pages Facebook.

## 🎯 Fonctionnalités

- ✅ **Surveillance automatique** des commentaires sur vos pages Facebook
- ✅ **Réponses personnalisées** basées sur un prompt que vous définissez
- ✅ **Configuration par page** - Activez l'agent sur les pages que vous souhaitez
- ✅ **Tonalité personnalisable** (Amical, Professionnel, Décontracté)
- ✅ **Délai configurable** avant réponse
- ✅ **Statistiques** en temps réel
- ✅ **Activation/Désactivation** facile

## 🚀 Comment ça marche

### 1. Architecture du système

```
┌─────────────────┐
│  Facebook API   │ ← Récupère les commentaires toutes les minutes
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Comment Monitor │ ← Vérifie les nouveaux commentaires
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Agent IA Logic  │ ← Génère la réponse basée sur le prompt
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Facebook API   │ ← Poste la réponse
└─────────────────┘
```

### 2. Processus de réponse

1. **Monitoring**: L'agent vérifie les commentaires toutes les 60 secondes
2. **Détection**: Identifie les nouveaux commentaires non traités
3. **Délai**: Attend le délai configuré (si défini)
4. **Génération**: Crée une réponse basée sur votre prompt
5. **Publication**: Poste la réponse sur Facebook
6. **Enregistrement**: Marque le commentaire comme traité

## ⚙️ Configuration de l'agent

### Accéder à la configuration

1. Connectez-vous avec Facebook sur https://friday-tal7.onrender.com
2. Cliquez sur "⚙️ Configurer l'Agent IA"
3. Sélectionnez une page Facebook

### Paramètres disponibles

#### 🟢 Activer l'agent IA
Active ou désactive la surveillance des commentaires pour cette page.

#### 📝 Prompt de l'agent
Définit le comportement et le ton de l'agent. Exemples:

**Exemple 1 - Service client:**
```
Je suis l'assistant virtuel de [Votre Entreprise]. Je réponds de manière courtoise
et professionnelle aux questions. Pour les demandes techniques, je suggère de
contacter notre support. J'utilise un ton chaleureux et rassurant.
```

**Exemple 2 - Boutique en ligne:**
```
Je suis l'assistant shopping de [Votre Boutique]. Je suis enthousiaste et
j'encourage les clients. Pour les questions sur les prix ou la disponibilité,
je les invite à visiter notre site web ou à nous contacter en privé.
```

**Exemple 3 - Influenceur/Créateur:**
```
Je suis l'assistant de [Votre Nom]. Je remercie les fans pour leur soutien
et réponds aux questions simples. J'utilise un ton décontracté et amical
avec des emojis occasionnels 😊
```

#### 🎭 Ton général
- **Amical**: Chaleureux et accueillant
- **Professionnel**: Formel et courtois
- **Décontracté**: Relaxé et informel

#### 🌍 Langue
Langue des réponses automatiques (Français, English, Español)

#### ⚡ Réponses automatiques
Active/désactive les réponses automatiques (peut être désactivé pour uniquement surveiller)

#### ⏱️ Délai avant réponse
Temps d'attente en minutes avant de répondre (0 = immédiat)

**Pourquoi utiliser un délai?**
- Laisser du temps pour une réponse manuelle
- Paraître plus humain
- Éviter de répondre trop vite

## 📊 Statistiques

Le tableau de bord affiche:
- **Réponses automatiques**: Nombre total de commentaires traités
- **Pages surveillées**: Nombre de pages configurées
- **Agents actifs**: Nombre d'agents actuellement en fonctionnement

## 🔍 Exemples d'utilisation

### Cas d'usage 1: E-commerce

**Configuration:**
- Prompt: "Je réponds aux questions sur nos produits. Pour les commandes, je dirige vers le site web."
- Ton: Professionnel
- Délai: 2 minutes

**Résultat:**
```
Commentaire: "C'est disponible en bleu ?"
Réponse: "Nous vous remercions pour votre retour. Pour consulter toutes les
         couleurs disponibles et passer commande, visitez notre site web."
```

### Cas d'usage 2: Community Manager

**Configuration:**
- Prompt: "Je remercie les gens pour leurs commentaires et encourage l'engagement"
- Ton: Amical
- Délai: 0 minutes

**Résultat:**
```
Commentaire: "Super post !"
Réponse: "Merci pour votre commentaire ! Nous apprécions votre soutien 😊"
```

### Cas d'usage 3: Restaurant

**Configuration:**
- Prompt: "Je réponds aux questions sur nos horaires et réservations. J'invite à appeler pour réserver."
- Ton: Professionnel
- Délai: 5 minutes

**Résultat:**
```
Commentaire: "Vous êtes ouverts dimanche ?"
Réponse: "Merci pour votre message. Pour connaître nos horaires d'ouverture
         et réserver une table, n'hésitez pas à nous contacter."
```

## 🛡️ Bonnes pratiques

### ✅ À faire

1. **Testez d'abord**: Activez sur une page test avant la production
2. **Soyez clair**: Donnez des instructions précises dans le prompt
3. **Supervisez**: Vérifiez régulièrement les réponses générées
4. **Ajustez**: Modifiez le prompt si les réponses ne conviennent pas
5. **Utilisez un délai**: Permet une intervention manuelle si nécessaire

### ❌ À éviter

1. **Prompts vagues**: "Réponds aux commentaires" → Trop général
2. **Pas de supervision**: Toujours surveiller les réponses
3. **Ton inapproprié**: Adaptez le ton à votre audience
4. **Réponse immédiate**: Un petit délai paraît plus humain
5. **Activer partout**: Commencez par 1-2 pages

## 🔧 Fonctionnement technique

### Base de données

Trois tables gèrent le système:

1. **agent_configs**: Stocke les configurations par page
2. **processed_comments**: Évite les réponses en double
3. **users**: Contient les tokens d'accès Facebook

### API Facebook utilisée

- **GET /page_id/posts**: Récupère les posts récents
- **GET /post_id/comments**: Récupère les commentaires
- **POST /comment_id/comments**: Poste une réponse

### Permissions requises

Pour que l'agent fonctionne, vous devez avoir:
- `pages_show_list` - Lister les pages ✅
- `pages_read_engagement` - Lire les commentaires ✅
- `pages_manage_posts` - Répondre aux commentaires (nécessite App Review) ⚠️

**Note**: Actuellement, seules les permissions de base sont actives. Pour répondre
aux commentaires, vous devrez obtenir `pages_manage_posts` via l'App Review de Meta.

## 🚨 Limitations actuelles

### Permissions manquantes

L'agent peut **surveiller** les commentaires mais **ne peut pas encore y répondre**
car la permission `pages_manage_posts` nécessite une App Review de Meta.

**Pour activer les réponses:**
1. Complétez la Business Verification sur Meta
2. Soumettez une App Review pour `pages_manage_posts`
3. Une fois approuvé, l'agent pourra répondre automatiquement

### En attendant l'approbation

Vous pouvez quand même:
- ✅ Configurer l'agent et le prompt
- ✅ Tester la surveillance des commentaires
- ✅ Voir les statistiques
- ✅ Préparer votre stratégie de réponses

## 📈 Améliorer les réponses

### Version actuelle

Les réponses sont générées via des templates basiques combinés avec votre prompt.

### Version future (avec IA avancée)

Il est possible d'intégrer:
- **OpenAI GPT-4**: Pour des réponses plus naturelles
- **Claude API**: Pour une compréhension contextuelle
- **Custom ML Model**: Pour des réponses spécifiques à votre domaine

**Exemple d'intégration OpenAI:**
```javascript
async function generateReply(commentMessage, config) {
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: config.prompt },
      { role: "user", content: commentMessage }
    ]
  });

  return response.choices[0].message.content;
}
```

## 🔒 Sécurité et confidentialité

- ✅ Les tokens d'accès sont stockés de manière sécurisée
- ✅ Seul le propriétaire de la page peut configurer l'agent
- ✅ Les commentaires traités sont enregistrés pour éviter les doublons
- ✅ Aucune donnée n'est partagée avec des tiers

## 🆘 Dépannage

### L'agent ne répond pas

**Vérifiez:**
1. L'agent est bien activé (toggle vert)
2. Les réponses automatiques sont activées
3. Le délai n'est pas trop long
4. Il y a de nouveaux commentaires à traiter
5. La permission `pages_manage_posts` est accordée

### Les réponses ne correspondent pas

**Solution:**
1. Modifiez le prompt pour être plus spécifique
2. Changez le ton (Amical/Professionnel/Décontracté)
3. Testez différentes formulations

### Erreur "Permission denied"

**Cause:** La permission `pages_manage_posts` n'est pas approuvée

**Solution:** Complétez l'App Review sur Meta for Developers

## 📞 Support

Pour toute question ou problème:
1. Consultez la documentation dans les fichiers `README.md`, `PERMISSIONS.md`, `API.md`
2. Vérifiez les logs du serveur pour les erreurs
3. Contactez le support si nécessaire

---

**Développé pour l'Agent IA Friday • Powered by Meta Graph API**
