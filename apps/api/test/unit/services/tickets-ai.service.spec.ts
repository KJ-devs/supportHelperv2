import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { TicketsAIService } from '../../../src/modules/tickets/tickets-ai.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AIService } from '../../../src/ai/ai.service';

describe('TicketsAIService', () => {
  let service: TicketsAIService;
  let prisma: jest.Mocked<PrismaService>;
  let mockQueue: any;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({}),
      getWaitingCount: jest.fn().mockResolvedValue(5),
      getActiveCount: jest.fn().mockResolvedValue(2),
      getCompletedCount: jest.fn().mockResolvedValue(100),
      getFailedCount: jest.fn().mockResolvedValue(3),
      clean: jest.fn().mockResolvedValue([]),
      close: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsAIService,
        {
          provide: PrismaService,
          useValue: {
            ticket: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
            $queryRaw: jest.fn(),
            $executeRaw: jest.fn(),
          },
        },
        {
          provide: AIService,
          useValue: {
            generateEmbedding: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getQueueToken('ticket-analysis'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<TicketsAIService>(TicketsAIService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('enqueueAnalysis', () => {
    it('should add job to queue with default priority', async () => {
      await service.enqueueAnalysis('ticket-123');

      expect(mockQueue.add).toHaveBeenCalledWith(
        'analyze-ticket',
        expect.objectContaining({ ticketId: 'ticket-123' }),
        expect.objectContaining({ priority: 5, attempts: 3 }),
      );
    });

    it('should add job with custom priority', async () => {
      await service.enqueueAnalysis('ticket-123', 1);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'analyze-ticket',
        expect.objectContaining({ ticketId: 'ticket-123' }),
        expect.objectContaining({ priority: 1 }),
      );
    });

    it('should throw when queue.add fails', async () => {
      mockQueue.add.mockRejectedValue(new Error('Queue error'));

      await expect(service.enqueueAnalysis('ticket-123')).rejects.toThrow('Queue error');
    });
  });

  describe('findSimilar', () => {
    it('should use vector search when available', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue({ id: 'ticket-123', title: 'Bug', description: 'desc' });
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([
        { id: 'similar-1', title: 'Similar Bug', similarity: 0.9 },
      ]);

      const result = await service.findSimilar('ticket-123', 'tenant-123');

      expect(result).toHaveLength(1);
    });

    it('should throw when ticket not found', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findSimilar('missing', 'tenant-123')).rejects.toThrow('Ticket not found');
    });

    it('should fallback to keyword search when vector search fails', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue({ id: 'ticket-123', title: 'Login error problem', description: 'Cannot login' });
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('Vector not available'));
      (prisma.ticket.findMany as jest.Mock).mockResolvedValue([
        { id: 'similar-2', title: 'Login issue', similarity: 0.5 },
      ]);

      const result = await service.findSimilar('ticket-123', 'tenant-123');

      expect(prisma.ticket.findMany).toHaveBeenCalled();
    });
  });

  describe('updateKeywords', () => {
    it('should update ticket keywords', async () => {
      (prisma.ticket.update as jest.Mock).mockResolvedValue({});

      await service.updateKeywords('ticket-123', ['bug', 'login']);

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-123' },
        data: { keywords: ['bug', 'login'] },
      });
    });
  });

  describe('storeEmbedding', () => {
    it('should store embedding via raw SQL', async () => {
      (prisma.$executeRaw as jest.Mock).mockResolvedValue(1);

      await service.storeEmbedding('ticket-123', [0.1, 0.2, 0.3]);

      expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it('should throw when storage fails', async () => {
      (prisma.$executeRaw as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(service.storeEmbedding('ticket-123', [0.1])).rejects.toThrow('DB error');
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      const result = await service.getQueueStats();

      expect(result).toEqual({ waiting: 5, active: 2, completed: 100, failed: 3 });
    });
  });

  describe('cleanupQueue', () => {
    it('should clean completed and failed jobs', async () => {
      await service.cleanupQueue();

      expect(mockQueue.clean).toHaveBeenCalledTimes(2);
    });
  });
});
