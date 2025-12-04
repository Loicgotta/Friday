/**
 * Service RAG (Retrieval-Augmented Generation)
 * Indexe les documents et répond aux questions en utilisant OpenAI
 */

const OpenAI = require('openai');

class RAGService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // Cache des embeddings et documents indexés (par utilisateur)
    this.userIndexes = new Map();
  }

  /**
   * Créer un embedding pour un texte
   */
  async createEmbedding(text) {
    // Limiter la taille du texte pour l'embedding
    const truncatedText = text.slice(0, 8000);

    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: truncatedText
    });

    return response.data[0].embedding;
  }

  /**
   * Diviser un document en chunks
   */
  chunkDocument(text, chunkSize = 1000, overlap = 200) {
    const chunks = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start += chunkSize - overlap;
    }

    return chunks;
  }

  /**
   * Indexer un document pour un utilisateur
   */
  async indexDocument(userId, fileId, fileName, content) {
    if (!this.userIndexes.has(userId)) {
      this.userIndexes.set(userId, {
        documents: [],
        lastIndexed: null
      });
    }

    const userIndex = this.userIndexes.get(userId);

    // Diviser en chunks
    const chunks = this.chunkDocument(content);

    // Créer les embeddings pour chaque chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (chunk.trim().length < 10) continue; // Ignorer les chunks vides

      try {
        const embedding = await this.createEmbedding(chunk);

        userIndex.documents.push({
          fileId,
          fileName,
          chunkIndex: i,
          content: chunk,
          embedding
        });
      } catch (error) {
        console.error(`Erreur indexation chunk ${i} de ${fileName}:`, error.message);
      }
    }

    userIndex.lastIndexed = new Date();
    console.log(`Document indexé: ${fileName} (${chunks.length} chunks)`);
  }

  /**
   * Indexer tous les documents d'un utilisateur
   */
  async indexAllDocuments(userId, documents) {
    console.log(`Début indexation de ${documents.length} documents pour l'utilisateur ${userId}`);

    // Réinitialiser l'index
    this.userIndexes.set(userId, {
      documents: [],
      lastIndexed: null
    });

    let indexed = 0;
    let errors = 0;

    for (const doc of documents) {
      try {
        await this.indexDocument(userId, doc.fileId, doc.fileName, doc.content);
        indexed++;
      } catch (error) {
        console.error(`Erreur indexation ${doc.fileName}:`, error.message);
        errors++;
      }
    }

    const userIndex = this.userIndexes.get(userId);
    userIndex.lastIndexed = new Date();

    console.log(`Indexation terminée: ${indexed} documents, ${errors} erreurs`);

    return {
      indexed,
      errors,
      totalChunks: userIndex.documents.length
    };
  }

  /**
   * Calculer la similarité cosinus entre deux vecteurs
   */
  cosineSimilarity(a, b) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Rechercher les documents les plus pertinents pour une question
   */
  async searchRelevantChunks(userId, query, topK = 5) {
    const userIndex = this.userIndexes.get(userId);

    if (!userIndex || userIndex.documents.length === 0) {
      return [];
    }

    // Créer l'embedding de la question
    const queryEmbedding = await this.createEmbedding(query);

    // Calculer les similarités
    const similarities = userIndex.documents.map(doc => ({
      ...doc,
      similarity: this.cosineSimilarity(queryEmbedding, doc.embedding)
    }));

    // Trier par similarité décroissante et prendre les top K
    similarities.sort((a, b) => b.similarity - a.similarity);

    return similarities.slice(0, topK);
  }

  /**
   * Générer une réponse à une question en utilisant le contexte des documents
   */
  async generateAnswer(userId, question, conversationHistory = []) {
    // Rechercher les chunks pertinents
    const relevantChunks = await this.searchRelevantChunks(userId, question, 5);

    if (relevantChunks.length === 0) {
      return {
        answer: "Je n'ai pas encore indexé de documents pour votre compte. Veuillez d'abord synchroniser vos documents Google Drive en cliquant sur 'Synchroniser'.",
        sources: []
      };
    }

    // Construire le contexte
    const context = relevantChunks.map((chunk, i) =>
      `[Document: ${chunk.fileName}]\n${chunk.content}`
    ).join('\n\n---\n\n');

    // Construire les messages pour l'API
    const messages = [
      {
        role: 'system',
        content: `Tu es Friday, un assistant IA intelligent qui aide les utilisateurs à trouver des informations dans leurs documents Google Drive.

Tu as accès aux documents suivants de l'utilisateur. Utilise UNIQUEMENT ces informations pour répondre aux questions. Si tu ne trouves pas l'information dans les documents, dis-le clairement.

Règles:
1. Réponds en français
2. Sois précis et cite les sources (noms des documents) quand possible
3. Si la question n'est pas liée aux documents, tu peux avoir une conversation normale
4. Tu peux analyser, résumer, comparer les informations des documents
5. Si on te demande de lister ou résumer tous les documents, donne un aperçu de ce que tu as trouvé

CONTEXTE DES DOCUMENTS:
${context}`
      },
      ...conversationHistory.slice(-10), // Garder les 10 derniers messages
      {
        role: 'user',
        content: question
      }
    ];

    // Appeler OpenAI
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 2000
    });

    const answer = response.data?.choices?.[0]?.message?.content ||
                   response.choices?.[0]?.message?.content ||
                   "Désolé, je n'ai pas pu générer une réponse.";

    // Extraire les sources uniques
    const sources = [...new Set(relevantChunks.map(c => c.fileName))];

    return {
      answer,
      sources,
      relevantChunks: relevantChunks.map(c => ({
        fileName: c.fileName,
        similarity: c.similarity.toFixed(3)
      }))
    };
  }

  /**
   * Obtenir les statistiques de l'index d'un utilisateur
   */
  getIndexStats(userId) {
    const userIndex = this.userIndexes.get(userId);

    if (!userIndex) {
      return {
        indexed: false,
        totalChunks: 0,
        totalDocuments: 0,
        lastIndexed: null
      };
    }

    // Compter les documents uniques
    const uniqueFiles = new Set(userIndex.documents.map(d => d.fileId));

    return {
      indexed: true,
      totalChunks: userIndex.documents.length,
      totalDocuments: uniqueFiles.size,
      lastIndexed: userIndex.lastIndexed
    };
  }

  /**
   * Effacer l'index d'un utilisateur
   */
  clearIndex(userId) {
    this.userIndexes.delete(userId);
    console.log(`Index effacé pour l'utilisateur ${userId}`);
  }
}

module.exports = RAGService;
