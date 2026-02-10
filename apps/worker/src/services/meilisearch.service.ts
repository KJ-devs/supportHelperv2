import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MeiliSearch, Index } from 'meilisearch';
import { getErrorMessage } from '../utils/error.utils';

/**
 * Meilisearch Service
 *
 * Handles search indexing operations:
 * - Index tickets for full-text search
 * - Vector search support
 * - Real-time index updates
 */
@Injectable()
export class MeilisearchService implements OnModuleInit {
  private readonly logger = new Logger(MeilisearchService.name);
  private client!: MeiliSearch;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const host = this.configService.get<string>('MEILISEARCH_HOST', 'http://localhost:7700');
    const apiKey = this.configService.get<string>('MEILISEARCH_API_KEY');

    this.client = new MeiliSearch({
      host,
      apiKey,
    });

    await this.setupIndexes();
    this.logger.log('Meilisearch service initialized');
  }

  /**
   * Setup required indexes
   */
  private async setupIndexes(): Promise<void> {
    try {
      // Create tickets index
      await this.client.createIndex('tickets', { primaryKey: 'id' });
      const ticketsIndex = this.client.index('tickets');

      // Configure searchable and filterable attributes
      await ticketsIndex.updateSettings({
        searchableAttributes: ['title', 'description', 'aiSummary', 'ocrText', 'keywords'],
        filterableAttributes: [
          'tenantId',
          'applicationId',
          'status',
          'type',
          'severity',
          'createdAt',
        ],
        sortableAttributes: ['createdAt', 'updatedAt', 'priority'],
        rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
      });

      this.logger.log('Meilisearch indexes configured');
    } catch (error) {
      // Index might already exist, which is fine
      this.logger.debug(`Index setup: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get index by name
   */
  getIndex(indexName: string): Index {
    return this.client.index(indexName);
  }

  /**
   * Index a document
   */
  async indexDocument(indexName: string, document: Record<string, unknown>): Promise<void> {
    try {
      const index = this.getIndex(indexName);
      await index.addDocuments([document]);
      this.logger.debug(`Indexed document ${document.id} in ${indexName}`);
    } catch (error) {
      this.logger.error(`Failed to index document: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Index multiple documents
   */
  async indexDocuments(indexName: string, documents: Record<string, unknown>[]): Promise<void> {
    try {
      const index = this.getIndex(indexName);
      await index.addDocuments(documents);
      this.logger.debug(`Indexed ${documents.length} documents in ${indexName}`);
    } catch (error) {
      this.logger.error(`Failed to index documents: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Update a document
   */
  async updateDocument(indexName: string, document: Record<string, unknown>): Promise<void> {
    try {
      const index = this.getIndex(indexName);
      await index.updateDocuments([document]);
      this.logger.debug(`Updated document ${document.id} in ${indexName}`);
    } catch (error) {
      this.logger.error(`Failed to update document: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(indexName: string, documentId: string): Promise<void> {
    try {
      const index = this.getIndex(indexName);
      await index.deleteDocument(documentId);
      this.logger.debug(`Deleted document ${documentId} from ${indexName}`);
    } catch (error) {
      this.logger.error(`Failed to delete document: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Search documents
   */
  async search(
    indexName: string,
    query: string,
    options: {
      filter?: string;
      limit?: number;
      offset?: number;
      sort?: string[];
      attributesToRetrieve?: string[];
    } = {}
  ): Promise<{
    hits: any[];
    estimatedTotalHits: number;
    processingTimeMs: number;
  }> {
    try {
      const index = this.getIndex(indexName);
      const result = await index.search(query, {
        filter: options.filter,
        limit: options.limit || 20,
        offset: options.offset || 0,
        sort: options.sort,
        attributesToRetrieve: options.attributesToRetrieve,
      });

      return {
        hits: result.hits,
        estimatedTotalHits: result.estimatedTotalHits || 0,
        processingTimeMs: result.processingTimeMs,
      };
    } catch (error) {
      this.logger.error(`Search failed: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Get document by ID
   */
  async getDocument(indexName: string, documentId: string): Promise<any> {
    try {
      const index = this.getIndex(indexName);
      return await index.getDocument(documentId);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'document_not_found') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Check health
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.client.health();
      return true;
    } catch {
      return false;
    }
  }
}
