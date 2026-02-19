import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MeiliSearch, Index } from 'meilisearch';
import { SearchTicketsDto } from './dto';

export interface TicketDocument {
  id: string;
  title: string;
  description: string | null;
  status: string;
  type: string | null;
  severity: string | null;
  aiSummary: string | null;
  keywords: string[];
  tenantId: string;
  applicationId: string;
  createdAt: number; // Timestamp for sorting
  updatedAt: number;
}

@Injectable()
export class TicketsSearchService implements OnModuleInit {
  private readonly logger = new Logger(TicketsSearchService.name);
  private client: MeiliSearch;
  private index: Index<TicketDocument>;
  private readonly indexName = 'tickets';
  private readonly enabled: boolean;

  constructor(private config: ConfigService) {
    const host = this.config.get('meilisearch.host');
    const apiKey = this.config.get('meilisearch.apiKey');

    this.enabled = !!host;

    if (this.enabled) {
      this.client = new MeiliSearch({
        host,
        apiKey,
      });
    }
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.warn('Meilisearch is not configured, search will be disabled');
      return;
    }

    try {
      // Create or get index
      this.index = this.client.index<TicketDocument>(this.indexName);

      // Configure index settings
      await this.index.updateSettings({
        searchableAttributes: [
          'title',
          'description',
          'aiSummary',
          'keywords',
        ],
        filterableAttributes: [
          'tenantId',
          'status',
          'type',
          'severity',
          'applicationId',
        ],
        sortableAttributes: ['createdAt', 'updatedAt'],
        rankingRules: [
          'words',
          'typo',
          'proximity',
          'attribute',
          'sort',
          'exactness',
        ],
      });

      this.logger.log('Meilisearch index configured successfully');
    } catch (error) {
      this.logger.error('Failed to configure Meilisearch index', error);
    }
  }

  /**
   * Index a ticket in Meilisearch
   */
  async indexTicket(ticket: any): Promise<void> {
    if (!this.enabled) return;

    try {
      const document: TicketDocument = {
        id: ticket.id,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        type: ticket.type,
        severity: ticket.severity,
        aiSummary: ticket.aiSummary,
        keywords: ticket.keywords || [],
        tenantId: ticket.tenantId,
        applicationId: ticket.applicationId,
        createdAt: new Date(ticket.createdAt).getTime(),
        updatedAt: new Date(ticket.updatedAt).getTime(),
      };

      await this.index.addDocuments([document]);

      this.logger.debug(`Indexed ticket ${ticket.id}`);
    } catch (error) {
      this.logger.error(`Failed to index ticket ${ticket.id}`, error);
    }
  }

  /**
   * Update ticket in Meilisearch
   */
  async updateTicket(ticket: any): Promise<void> {
    await this.indexTicket(ticket); // Meilisearch upserts by default
  }

  /**
   * Remove ticket from Meilisearch
   */
  async removeTicket(ticketId: string): Promise<void> {
    if (!this.enabled) return;

    try {
      await this.index.deleteDocument(ticketId);
      this.logger.debug(`Removed ticket ${ticketId} from index`);
    } catch (error) {
      this.logger.error(`Failed to remove ticket ${ticketId}`, error);
    }
  }

  /**
   * Search tickets
   */
  async search(tenantId: string, dto: SearchTicketsDto) {
    if (!this.enabled) {
      throw new ServiceUnavailableException('Search is not available (Meilisearch not configured)');
    }

    const { query, limit = 20, offset = 0, status, severity, type } = dto;

    try {
      // Build filters
      const filters: string[] = [`tenantId = ${tenantId}`];

      if (status) {
        const statuses = status.split(',').map((s) => `status = ${s}`);
        filters.push(`(${statuses.join(' OR ')})`);
      }

      if (severity) {
        const severities = severity.split(',').map((s) => `severity = ${s}`);
        filters.push(`(${severities.join(' OR ')})`);
      }

      if (type) {
        const types = type.split(',').map((t) => `type = ${t}`);
        filters.push(`(${types.join(' OR ')})`);
      }

      const filterString = filters.join(' AND ');

      const results = await this.index.search(query, {
        filter: filterString,
        limit,
        offset,
        sort: ['createdAt:desc'],
        attributesToHighlight: ['title', 'description'],
      });

      return {
        hits: results.hits,
        totalHits: results.estimatedTotalHits || 0,
        query: results.query,
        processingTimeMs: results.processingTimeMs,
        limit,
        offset,
      };
    } catch (error) {
      this.logger.error('Search failed', error);
      throw error;
    }
  }

  /**
   * Bulk index tickets (for initial indexing or re-indexing)
   */
  async bulkIndex(tickets: any[]): Promise<void> {
    if (!this.enabled) return;

    try {
      const documents: TicketDocument[] = tickets.map((ticket) => ({
        id: ticket.id,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        type: ticket.type,
        severity: ticket.severity,
        aiSummary: ticket.aiSummary,
        keywords: ticket.keywords || [],
        tenantId: ticket.tenantId,
        applicationId: ticket.applicationId,
        createdAt: new Date(ticket.createdAt).getTime(),
        updatedAt: new Date(ticket.updatedAt).getTime(),
      }));

      await this.index.addDocuments(documents);

      this.logger.log(`Bulk indexed ${documents.length} tickets`);
    } catch (error) {
      this.logger.error('Bulk indexing failed', error);
      throw error;
    }
  }

  /**
   * Clear all tickets from index (use with caution)
   */
  async clearIndex(): Promise<void> {
    if (!this.enabled) return;

    try {
      await this.index.deleteAllDocuments();
      this.logger.log('Cleared all tickets from index');
    } catch (error) {
      this.logger.error('Failed to clear index', error);
      throw error;
    }
  }

  /**
   * Check if Meilisearch is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}
