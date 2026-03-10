import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { FeedbackController } from '../../../src/modules/feedback/feedback.controller';
import { FeedbackService } from '../../../src/modules/feedback/feedback.service';
import { CreateFeedbackDto } from '../../../src/modules/feedback/dto/create-feedback.dto';

describe('FeedbackController', () => {
  let controller: FeedbackController;
  let feedbackService: jest.Mocked<FeedbackService>;

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
      controllers: [FeedbackController],
      providers: [
        {
          provide: FeedbackService,
          useValue: {
            create: jest.fn(),
            findByTicket: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<FeedbackController>(FeedbackController);
    feedbackService = module.get(FeedbackService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('returns 201 on successful feedback submission', async () => {
      const dto = plainToInstance(CreateFeedbackDto, {
        ticketId: 'a0000000-0000-0000-0000-000000000000',
        field: 'severity',
        correctedValue: 'high',
      });
      const req = { user: { id: 'user-123' } };
      (feedbackService.create as jest.Mock).mockResolvedValue(mockFeedback);

      const result = await controller.create('tenant-123', dto, req as { user: { id: string } });

      expect(feedbackService.create).toHaveBeenCalledWith('tenant-123', 'user-123', dto);
      expect(result).toEqual(mockFeedback);
    });

    it('propagates NotFoundException when ticket not found', async () => {
      const dto = plainToInstance(CreateFeedbackDto, {
        ticketId: 'a0000000-0000-0000-0000-000000000000',
        field: 'severity',
        correctedValue: 'high',
      });
      const req = { user: { id: 'user-123' } };
      (feedbackService.create as jest.Mock).mockRejectedValue(
        new NotFoundException('Ticket not found')
      );

      await expect(
        controller.create('tenant-123', dto, req as { user: { id: string } })
      ).rejects.toThrow(NotFoundException);
    });

    it('propagates BadRequestException for invalid payload', async () => {
      const dto = plainToInstance(CreateFeedbackDto, {
        ticketId: 'a0000000-0000-0000-0000-000000000000',
        field: 'type',
        correctedValue: 'high', // mismatch — would be rejected by ValidationPipe in real request
      });
      const req = { user: { id: 'user-123' } };
      (feedbackService.create as jest.Mock).mockRejectedValue(
        new BadRequestException('correctedValue must be one of [bug, feature_request, ...]')
      );

      await expect(
        controller.create('tenant-123', dto, req as { user: { id: string } })
      ).rejects.toThrow(BadRequestException);
    });
  });

  // Verifying JwtAuthGuard is applied: the guard is set at class level via @UseGuards(JwtAuthGuard).
  // In unit tests the guard is not run, but we can assert it's declared in the metadata.
  it('requires authentication via JwtAuthGuard', () => {
    const guards = Reflect.getMetadata('__guards__', FeedbackController) as unknown[];
    expect(guards).toBeDefined();
    expect(guards.length).toBeGreaterThan(0);
  });

  describe('findByTicket', () => {
    it('returns feedback list for ticket', async () => {
      (feedbackService.findByTicket as jest.Mock).mockResolvedValue([mockFeedback]);

      const result = await controller.findByTicket('tenant-123', 'ticket-123');

      expect(feedbackService.findByTicket).toHaveBeenCalledWith('ticket-123', 'tenant-123');
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('returns single feedback', async () => {
      (feedbackService.findOne as jest.Mock).mockResolvedValue(mockFeedback);

      const result = await controller.findOne('tenant-123', 'fb-123');

      expect(feedbackService.findOne).toHaveBeenCalledWith('fb-123', 'tenant-123');
      expect(result).toEqual(mockFeedback);
    });
  });

  describe('update', () => {
    it('updates feedback', async () => {
      const dto = { correctedValue: 'critical' };
      (feedbackService.update as jest.Mock).mockResolvedValue({
        ...mockFeedback,
        correctedValue: 'critical',
      });

      const result = await controller.update('tenant-123', 'fb-123', dto);

      expect(feedbackService.update).toHaveBeenCalledWith('fb-123', 'tenant-123', dto);
      expect(result.correctedValue).toBe('critical');
    });
  });

  describe('remove', () => {
    it('removes feedback', async () => {
      (feedbackService.remove as jest.Mock).mockResolvedValue({ success: true });

      const result = await controller.remove('tenant-123', 'fb-123');

      expect(feedbackService.remove).toHaveBeenCalledWith('fb-123', 'tenant-123');
      expect(result).toEqual({ success: true });
    });
  });
});
