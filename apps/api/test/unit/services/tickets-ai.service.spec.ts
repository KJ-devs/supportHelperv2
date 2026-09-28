import { Test, TestingModule } from '@nestjs/testing';
import { TicketsAIService } from '../../../src/modules/tickets/tickets-ai.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AIService } from '../../../src/ai/ai.service';

describe('TicketsAIService', () => {
  let service: TicketsAIService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
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
      ],
    }).compile();

    service = module.get<TicketsAIService>(TicketsAIService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findSimilar', () => {
    it('should use vector search when available', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue({ id: 'ticket-123', title: 'Bug', description: 'desc' });
      // 1st query: the source ticket has an embedding; 2nd: nearest neighbours
      (prisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([{ has_emb: true }])
        .mockResolvedValueOnce([{ id: 'similar-1', title: 'Similar Bug', similarity: 0.9 }]);

      const result = await service.findSimilar('ticket-123', 'tenant-123');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 'similar-1' });
      expect(prisma.ticket.findMany).not.toHaveBeenCalled();
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
});
