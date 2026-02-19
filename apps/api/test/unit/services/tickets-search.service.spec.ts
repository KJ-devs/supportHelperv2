import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TicketsSearchService } from '../../../src/modules/tickets/tickets-search.service';

const mockIndex = {
  updateSettings: jest.fn().mockResolvedValue({}),
  addDocuments: jest.fn().mockResolvedValue({}),
  deleteDocument: jest.fn().mockResolvedValue({}),
  deleteAllDocuments: jest.fn().mockResolvedValue({}),
  search: jest.fn().mockResolvedValue({
    hits: [{ id: 'ticket-1', title: 'Bug' }],
    estimatedTotalHits: 1,
    query: 'bug',
    processingTimeMs: 5,
  }),
};

jest.mock('meilisearch', () => ({
  MeiliSearch: jest.fn().mockImplementation(() => ({
    index: jest.fn().mockReturnValue(mockIndex),
  })),
}));

describe('TicketsSearchService', () => {
  let service: TicketsSearchService;

  describe('when enabled', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TicketsSearchService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'meilisearch.host') return 'http://localhost:7700';
                if (key === 'meilisearch.apiKey') return 'test-key';
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      service = module.get<TicketsSearchService>(TicketsSearchService);
      await service.onModuleInit();
      jest.clearAllMocks();
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should be enabled', () => {
      expect(service.isEnabled()).toBe(true);
    });

    describe('onModuleInit', () => {
      it('should configure index settings', async () => {
        await service.onModuleInit();
        expect(mockIndex.updateSettings).toHaveBeenCalled();
      });
    });

    describe('indexTicket', () => {
      it('should add document to index', async () => {
        await service.indexTicket({
          id: 'ticket-1', title: 'Bug', description: 'desc', status: 'open',
          type: 'bug', severity: 'high', aiSummary: null, keywords: [],
          tenantId: 't-1', applicationId: 'a-1', createdAt: new Date(), updatedAt: new Date(),
        });
        expect(mockIndex.addDocuments).toHaveBeenCalled();
      });
    });

    describe('removeTicket', () => {
      it('should delete document from index', async () => {
        await service.removeTicket('ticket-1');
        expect(mockIndex.deleteDocument).toHaveBeenCalledWith('ticket-1');
      });
    });

    describe('search', () => {
      it('should search with filters', async () => {
        const result = await service.search('tenant-1', { query: 'bug' } as unknown);

        expect(mockIndex.search).toHaveBeenCalledWith('bug', expect.objectContaining({
          filter: expect.stringContaining('tenantId = tenant-1'),
        }));
        expect(result.hits).toHaveLength(1);
        expect(result.totalHits).toBe(1);
      });

      it('should add status filter when provided', async () => {
        await service.search('tenant-1', { query: 'bug', status: 'open' } as unknown);

        expect(mockIndex.search).toHaveBeenCalledWith('bug', expect.objectContaining({
          filter: expect.stringContaining('status = open'),
        }));
      });
    });

    describe('bulkIndex', () => {
      it('should index multiple tickets', async () => {
        const tickets = [
          { id: 't-1', title: 'A', description: '', status: 'open', type: null, severity: null, aiSummary: null, keywords: [], tenantId: 'x', applicationId: 'y', createdAt: new Date(), updatedAt: new Date() },
          { id: 't-2', title: 'B', description: '', status: 'open', type: null, severity: null, aiSummary: null, keywords: [], tenantId: 'x', applicationId: 'y', createdAt: new Date(), updatedAt: new Date() },
        ];
        await service.bulkIndex(tickets);
        expect(mockIndex.addDocuments).toHaveBeenCalled();
      });
    });

    describe('clearIndex', () => {
      it('should clear all documents', async () => {
        await service.clearIndex();
        expect(mockIndex.deleteAllDocuments).toHaveBeenCalled();
      });
    });
  });

  describe('when disabled', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TicketsSearchService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(undefined),
            },
          },
        ],
      }).compile();

      service = module.get<TicketsSearchService>(TicketsSearchService);
    });

    it('should not be enabled', () => {
      expect(service.isEnabled()).toBe(false);
    });

    it('should throw when searching', async () => {
      await expect(service.search('t-1', { query: 'bug' } as unknown)).rejects.toThrow();
    });

    it('should no-op on indexTicket', async () => {
      await service.indexTicket({ id: 'x' } as unknown);
      // Should not throw
    });
  });
});
