import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TicketsSearchService, TicketDocument } from '@/modules/tickets/tickets-search.service';
import { MeiliSearch } from 'meilisearch';

const isIntegrationTest =
  !!process.env.TEST_MEILISEARCH_HOST && !!process.env.TEST_MEILISEARCH_API_KEY;

(isIntegrationTest ? describe : describe.skip)('MeiliSearch Integration', () => {
  let service: TicketsSearchService;
  let module: TestingModule;
  const testIndexName = `tickets-test-${Date.now()}`;

  beforeAll(async () => {
    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'meilisearch.host') return process.env.TEST_MEILISEARCH_HOST;
        if (key === 'meilisearch.apiKey') return process.env.TEST_MEILISEARCH_API_KEY;
        return undefined;
      }),
    };

    module = await Test.createTestingModule({
      providers: [
        TicketsSearchService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<TicketsSearchService>(TicketsSearchService);
    await service.onModuleInit();
  });

  afterAll(async () => {
    try {
      await service.clearIndex();
    } catch (error) {
      // Ignore cleanup errors
    }
    await module.close();
  });

  describe('Index Operations', () => {
    it('should verify MeiliSearch is enabled and configured', () => {
      expect(service.isEnabled()).toBe(true);
    });

    it('should index a ticket', async () => {
      const ticket = {
        id: 'ticket-ms-1',
        title: 'Test bug in login flow',
        description: 'Users cannot log in with email',
        status: 'new',
        type: 'bug',
        severity: 'high',
        aiSummary: 'Authentication issue affecting all users',
        keywords: ['authentication', 'login', 'bug'],
        tenantId: 'tenant-1',
        applicationId: 'app-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await service.indexTicket(ticket);
      await new Promise((resolve) => setTimeout(resolve, 500));

      const results = await service.search('tenant-1', {
        query: 'login',
        limit: 10,
        offset: 0,
      });

      expect(results.hits).toBeDefined();
      const found = results.hits.find((h: TicketDocument) => h.id === 'ticket-ms-1');
      expect(found).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should throw error when search is not configured', async () => {
      const disabledModule = await Test.createTestingModule({
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

      const disabledService = disabledModule.get<TicketsSearchService>(TicketsSearchService);
      await disabledService.onModuleInit();

      expect(disabledService.isEnabled()).toBe(false);

      await expect(
        disabledService.search('tenant-1', { query: 'test', limit: 20, offset: 0 })
      ).rejects.toThrow('Search is not available');

      await disabledModule.close();
    });
  });
});
