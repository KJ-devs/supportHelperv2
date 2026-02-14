import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FeedbackService } from '../../../src/modules/feedback/feedback.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('FeedbackService', () => {
  let service: FeedbackService;
  let prisma: jest.Mocked<PrismaService>;

  const mockTicket = { id: 'ticket-123', tenantId: 'tenant-123' };
  const mockFeedback = {
    id: 'fb-123',
    ticketId: 'ticket-123',
    field: 'severity',
    originalValue: 'low',
    correctedValue: 'high',
    correctedBy: 'user-123',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedbackService,
        {
          provide: PrismaService,
          useValue: {
            ticket: { findFirst: jest.fn() },
            classificationFeedback: {
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<FeedbackService>(FeedbackService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create feedback after verifying ticket', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.classificationFeedback.create as jest.Mock).mockResolvedValue(mockFeedback);

      const dto = { ticketId: 'ticket-123', field: 'severity', originalValue: 'low', correctedValue: 'high' };
      const result = await service.create('tenant-123', 'user-123', dto as any);

      expect(prisma.ticket.findFirst).toHaveBeenCalledWith({ where: { id: 'ticket-123', tenantId: 'tenant-123' } });
      expect(prisma.classificationFeedback.create).toHaveBeenCalled();
      expect(result).toEqual(mockFeedback);
    });

    it('should throw NotFoundException when ticket not found', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.create('tenant-123', 'user-123', { ticketId: 'missing' } as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByTicket', () => {
    it('should return feedback for ticket', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.classificationFeedback.findMany as jest.Mock).mockResolvedValue([mockFeedback]);

      const result = await service.findByTicket('ticket-123', 'tenant-123');

      expect(result).toHaveLength(1);
    });

    it('should throw NotFoundException when ticket not found', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findByTicket('missing', 'tenant-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('should return feedback by id', async () => {
      (prisma.classificationFeedback.findFirst as jest.Mock).mockResolvedValue(mockFeedback);

      const result = await service.findOne('fb-123', 'tenant-123');

      expect(result).toEqual(mockFeedback);
    });

    it('should throw NotFoundException when not found', async () => {
      (prisma.classificationFeedback.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('missing', 'tenant-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update feedback', async () => {
      (prisma.classificationFeedback.findFirst as jest.Mock).mockResolvedValue(mockFeedback);
      (prisma.classificationFeedback.update as jest.Mock).mockResolvedValue({ ...mockFeedback, correctedValue: 'critical' });

      const result = await service.update('fb-123', 'tenant-123', { correctedValue: 'critical' } as any);

      expect(result.correctedValue).toBe('critical');
    });
  });

  describe('remove', () => {
    it('should delete feedback and return success', async () => {
      (prisma.classificationFeedback.findFirst as jest.Mock).mockResolvedValue(mockFeedback);
      (prisma.classificationFeedback.delete as jest.Mock).mockResolvedValue(mockFeedback);

      const result = await service.remove('fb-123', 'tenant-123');

      expect(result).toEqual({ success: true });
    });

    it('should throw NotFoundException when not found', async () => {
      (prisma.classificationFeedback.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.remove('missing', 'tenant-123')).rejects.toThrow(NotFoundException);
    });
  });
});
