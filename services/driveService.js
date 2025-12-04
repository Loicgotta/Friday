/**
 * Service Google Drive
 * Gère l'accès et la lecture des fichiers du Drive de l'utilisateur
 */

const { google } = require('googleapis');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

class DriveService {
  constructor(authClient) {
    this.drive = google.drive({ version: 'v3', auth: authClient });
  }

  /**
   * Lister tous les fichiers du Drive (documents textuels uniquement)
   */
  async listFiles(pageToken = null, pageSize = 100) {
    const supportedMimeTypes = [
      'application/pdf',
      'application/vnd.google-apps.document',
      'application/vnd.google-apps.spreadsheet',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/json',
      'text/html'
    ];

    const mimeQuery = supportedMimeTypes
      .map(mime => `mimeType='${mime}'`)
      .join(' or ');

    const response = await this.drive.files.list({
      pageSize,
      pageToken,
      q: `(${mimeQuery}) and trashed=false`,
      fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, createdTime, parents)',
      orderBy: 'modifiedTime desc'
    });

    return {
      files: response.data.files || [],
      nextPageToken: response.data.nextPageToken
    };
  }

  /**
   * Récupérer tous les fichiers (avec pagination automatique)
   */
  async getAllFiles() {
    const allFiles = [];
    let pageToken = null;

    do {
      const { files, nextPageToken } = await this.listFiles(pageToken);
      allFiles.push(...files);
      pageToken = nextPageToken;
    } while (pageToken);

    return allFiles;
  }

  /**
   * Télécharger le contenu d'un fichier
   */
  async downloadFile(fileId, mimeType) {
    // Pour les fichiers Google Docs, on exporte en texte
    if (mimeType.startsWith('application/vnd.google-apps.')) {
      return this.exportGoogleDoc(fileId, mimeType);
    }

    // Pour les autres fichiers, on télécharge directement
    const response = await this.drive.files.get({
      fileId,
      alt: 'media'
    }, {
      responseType: 'arraybuffer'
    });

    return Buffer.from(response.data);
  }

  /**
   * Exporter un Google Doc vers du texte
   */
  async exportGoogleDoc(fileId, mimeType) {
    let exportMimeType = 'text/plain';

    if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      exportMimeType = 'text/csv';
    }

    const response = await this.drive.files.export({
      fileId,
      mimeType: exportMimeType
    }, {
      responseType: 'text'
    });

    return response.data;
  }

  /**
   * Extraire le texte d'un fichier selon son type
   */
  async extractTextFromFile(fileId, mimeType, fileName) {
    try {
      const content = await this.downloadFile(fileId, mimeType);

      // Google Docs - déjà en texte
      if (mimeType.startsWith('application/vnd.google-apps.')) {
        return typeof content === 'string' ? content : content.toString('utf-8');
      }

      // PDF
      if (mimeType === 'application/pdf') {
        const pdfData = await pdfParse(content);
        return pdfData.text;
      }

      // Word (.docx)
      if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const result = await mammoth.extractRawText({ buffer: content });
        return result.value;
      }

      // Excel (.xlsx) - extraire comme CSV
      if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        // Pour xlsx, on peut simplement retourner une représentation textuelle
        return `[Fichier Excel: ${fileName}] - Contenu tabulaire non directement lisible`;
      }

      // Fichiers texte (txt, md, csv, json, html)
      if (mimeType.startsWith('text/') || mimeType === 'application/json') {
        return content.toString('utf-8');
      }

      return `[Type de fichier non supporté: ${mimeType}]`;
    } catch (error) {
      console.error(`Erreur extraction ${fileName}:`, error.message);
      return `[Erreur lors de l'extraction du fichier: ${fileName}]`;
    }
  }

  /**
   * Obtenir les métadonnées d'un fichier
   */
  async getFileMetadata(fileId) {
    const response = await this.drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size, modifiedTime, createdTime, parents, webViewLink'
    });
    return response.data;
  }

  /**
   * Obtenir des statistiques sur le Drive
   */
  async getDriveStats() {
    const files = await this.getAllFiles();

    const stats = {
      totalFiles: files.length,
      byType: {},
      totalSize: 0,
      lastModified: null
    };

    files.forEach(file => {
      // Comptage par type
      const type = this.getMimeTypeLabel(file.mimeType);
      stats.byType[type] = (stats.byType[type] || 0) + 1;

      // Taille totale
      if (file.size) {
        stats.totalSize += parseInt(file.size);
      }

      // Dernière modification
      if (!stats.lastModified || new Date(file.modifiedTime) > new Date(stats.lastModified)) {
        stats.lastModified = file.modifiedTime;
      }
    });

    return stats;
  }

  /**
   * Convertir le mimeType en label lisible
   */
  getMimeTypeLabel(mimeType) {
    const labels = {
      'application/pdf': 'PDF',
      'application/vnd.google-apps.document': 'Google Doc',
      'application/vnd.google-apps.spreadsheet': 'Google Sheet',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
      'text/plain': 'Texte',
      'text/markdown': 'Markdown',
      'text/csv': 'CSV',
      'application/json': 'JSON',
      'text/html': 'HTML'
    };
    return labels[mimeType] || 'Autre';
  }
}

module.exports = DriveService;
