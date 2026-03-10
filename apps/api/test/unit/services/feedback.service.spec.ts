import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { FeedbackService } from '../../../src/modules/feedback/feedback.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { CreateFeedbackDto } from '../../../src/modules/feedback/dto/create-feedback.dto';

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

  // ─────────────────────────────────────────────────────────────────
  // DTO validation tests (class-validator)
  // ─────────────────────────────────────────────────────────────────
  describe('CreateFeedbackDto validation', () => {
    const VALID_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

    async function validateDto(plain: object) {
      const dto = plainToInstance(CreateFeedbackDto, plain);
      return validate(dto);
    }

    it('accepts valid type feedback', async () => {
      const errors = await validateDto({
        ticketId: VALID_UUID,
        field: 'type',
        correctedValue: 'feature_request',
      });
      expect(errors).toHaveLength(0);
    });

    it('accepts valid severity feedback', async () => {
      const errors = await validateDto({
        ticketId: VALID_UUID,
        field: 'severity',
        correctedValue: 'high',
      });
      expect(errors).toHaveLength(0);
    });

    it('accepts optional originalValue', async () => {
      const errors = await validateDto({
        ticketId: VALID_UUID,
        field: 'severity',
        correctedValue: 'low',
        originalValue: 'high',
      });
      expect(errors).toHaveLength(0);
    });

    it('rejects invalid field name', async () => {
      const errors = await validateDto({
        ticketId: VALID_UUID,
        field: 'status',
        correctedValue: 'open',
      });
      const fieldError = errors.find(e => e.property === 'field');
      expect(fieldError).toBeDefined();
    });

    it('rejects invalid type value', async () => {
      const errors = await validateDto({
        ticketId: VALID_UUID,
        field: 'type',
        correctedValue: 'invalid',
      });
      const valError = errors.find(e => e.property === 'correctedValue');
      expect(valError).toBeDefined();
      expect(Object.values(valError!.constraints ?? {})[0]).toMatch(
        /correctedValue must be one of/
      );
    });

    it('rejects invalid severity value', async () => {
      const errors = await validateDto({
        ticketId: VALID_UUID,
        field: 'severity',
        correctedValue: 'extreme',
      });
      const valError = errors.find(e => e.property === 'correctedValue');
      expect(valError).toBeDefined();
    });

    it('rejects mismatched field/value: field=type correctedValue=high', async () => {
      const errors = await validateDto({
        ticketId: VALID_UUID,
        field: 'type',
        correctedValue: 'high',
      });
      const valError = errors.find(e => e.property === 'correctedValue');
      expect(valError).toBeDefined();
      expect(Object.values(valError!.constraints ?? {})[0]).toMatch(/type/);
    });

    it('rejects mismatched field/value: field=severity correctedValue=bug', async () => {
      const errors = await validateDto({
        ticketId: VALID_UUID,
        field: 'severity',
        correctedValue: 'bug',
      });
      const valError = errors.find(e => e.property === 'correctedValue');
      expect(valError).toBeDefined();
    });

    it('rejects empty correctedValue', async () => {
      const errors = await validateDto({
        ticketId: VALID_UUID,
        field: 'severity',
        correctedValue: '',
      });
      const valError = errors.find(e => e.property === 'correctedValue');
      expect(valError).toBeDefined();
    });

    it('rejects missing correctedValue', async () => {
      const errors = await validateDto({
        ticketId: VALID_UUID,
        field: 'severity',
      });
      const valError = errors.find(e => e.property === 'correctedValue');
      expect(valError).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Service logic tests
  // ─────────────────────────────────────────────────────────────────
  describe('create', () => {
    it('creates new feedback when none exists for ticket+field', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.classificationFeedback.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.classificationFeedback.create as jest.Mock).mockResolvedValue(mockFeedback);

      const dto = plainToInstance(CreateFeedbackDto, {
        ticketId: 'ticket-123',
        field: 'severity',
        originalValue: 'low',
        correctedValue: 'high',
      });
      const result = await service.create('tenant-123', 'user-123', dto);

      expect(prisma.ticket.findFirst).toHaveBeenCalledWith({
        where: { id: 'ticket-123', tenantId: 'tenant-123' },
      });
      expect(prisma.classificationFeedback.create).toHaveBeenCalled();
      expect(prisma.classificationFeedback.update).not.toHaveBeenCalled();
      expect(result).toEqual(mockFeedback);
    });

    it('updates existing feedback when duplicate ticket+field exists', async () => {
      const updated = { ...mockFeedback, correctedValue: 'critical' };
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.classificationFeedback.findFirst as jest.Mock).mockResolvedValue(mockFeedback);
      (prisma.classificationFeedback.update as jest.Mock).mockResolvedValue(updated);

      const dto = plainToInstance(CreateFeedbackDto, {
        ticketId: 'ticket-123',
        field: 'severity',
        correctedValue: 'critical',
      });
      const result = await service.create('tenant-123', 'user-123', dto);

      expect(prisma.classificationFeedback.update).toHaveBeenCalledWith({
        where: { id: mockFeedback.id },
        data: expect.objectContaining({ correctedValue: 'critical' }),
      });
      expect(prisma.classificationFeedback.create).not.toHaveBeenCalled();
      expect(result.correctedValue).toBe('critical');
    });

    it('throws NotFoundException when ticket does not belong to tenant', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(null);

      const dto = plainToInstance(CreateFeedbackDto, {
        ticketId: 'ticket-other',
        field: 'severity',
        correctedValue: 'high',
      });

      await expect(service.create('tenant-123', 'user-123', dto)).rejects.toThrow(
        NotFoundException
      );
    });

    it('enforces tenant isolation — ticket from other tenant is not found', async () => {
      // Ticket exists but belongs to a different tenant — findFirst with tenantId filter returns null
      (prisma.ticket.findFirst as jest.Mock).mockImplementation(
        ({ where }: { where: { id: string; tenantId: string } }) => {
          if (where.tenantId === 'tenant-attacker') return null;
          return mockTicket;
        }
      );

      const dto = plainToInstance(CreateFeedbackDto, {
        ticketId: 'ticket-123',
        field: 'severity',
        correctedValue: 'high',
      });

      await expect(service.create('tenant-attacker', 'user-attacker', dto)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('findByTicket', () => {
    it('returns feedback list for ticket', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.classificationFeedback.findMany as jest.Mock).mockResolvedValue([mockFeedback]);

      const result = await service.findByTicket('ticket-123', 'tenant-123');

      expect(result).toHaveLength(1);
    });

    it('throws NotFoundException when ticket not found', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findByTicket('missing', 'tenant-123')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('findOne', () => {
    it('returns feedback by id', async () => {
      (prisma.classificationFeedback.findFirst as jest.Mock).mockResolvedValue(mockFeedback);

      const result = await service.findOne('fb-123', 'tenant-123');

      expect(result).toEqual(mockFeedback);
    });

    it('throws NotFoundException when not found', async () => {
      (prisma.classificationFeedback.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('missing', 'tenant-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates feedback', async () => {
      (prisma.classificationFeedback.findFirst as jest.Mock).mockResolvedValue(mockFeedback);
      (prisma.classificationFeedback.update as jest.Mock).mockResolvedValue({
        ...mockFeedback,
        correctedValue: 'critical',
      });

      const result = await service.update('fb-123', 'tenant-123', { correctedValue: 'critical' });

      expect(result.correctedValue).toBe('critical');
    });
  });

  describe('remove', () => {
    it('deletes feedback and returns success', async () => {
      (prisma.classificationFeedback.findFirst as jest.Mock).mockResolvedValue(mockFeedback);
      (prisma.classificationFeedback.delete as jest.Mock).mockResolvedValue(mockFeedback);

      const result = await service.remove('fb-123', 'tenant-123');

      expect(result).toEqual({ success: true });
    });

    it('throws NotFoundException when not found', async () => {
      (prisma.classificationFeedback.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.remove('missing', 'tenant-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByTicketIds', () => {
    it('returns empty array when ticketIds is empty', async () => {
      const result = await service.findByTicketIds([]);

      expect(result).toEqual([]);
      expect(prisma.classificationFeedback.findMany).not.toHaveBeenCalled();
    });

    it('returns feedback records for the given ticket IDs', async () => {
      const feedbackList = [
        { ...mockFeedback, id: 'fb-1', ticketId: 'ticket-123' },
        { ...mockFeedback, id: 'fb-2', ticketId: 'ticket-456', correctedValue: 'feature_request' },
      ];
      (prisma.classificationFeedback.findMany as jest.Mock).mockResolvedValue(feedbackList);

      const result = await service.findByTicketIds(['ticket-123', 'ticket-456']);

      expect(prisma.classificationFeedback.findMany).toHaveBeenCalledWith({
        where: { ticketId: { in: ['ticket-123', 'ticket-456'] } },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(2);
    });

    it('orders results by most recent first (createdAt desc)', async () => {
      (prisma.classificationFeedback.findMany as jest.Mock).mockResolvedValue([mockFeedback]);

      await service.findByTicketIds(['ticket-123']);

      expect(prisma.classificationFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } })
      );
    });

    it('passes ticket IDs as an IN filter to Prisma', async () => {
      (prisma.classificationFeedback.findMany as jest.Mock).mockResolvedValue([]);

      await service.findByTicketIds(['id-a', 'id-b', 'id-c']);

      expect(prisma.classificationFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ticketId: { in: ['id-a', 'id-b', 'id-c'] } },
        })
      );
    });

    it('returns empty array when no feedback exists for the given IDs', async () => {
      (prisma.classificationFeedback.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.findByTicketIds(['ticket-no-feedback']);

      expect(result).toEqual([]);
    });
  });
});
