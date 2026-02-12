import { Test, TestingModule } from '@nestjs/testing';
import { FeedbackController } from '../../../src/modules/feedback/feedback.controller';
import { FeedbackService } from '../../../src/modules/feedback/feedback.service';
import { CreateFeedbackDto } from '../../../src/modules/feedback/dto/create-feedback.dto';
import { UpdateFeedbackDto } from '../../../src/modules/feedback/dto/update-feedback.dto';

describe('FeedbackController', () => {
  let controller: FeedbackController;
  let feedbackService: jest.Mocked<FeedbackService>;

  const mockTenantId = 'tenant-123';
  const mockUserId = 'user-456';
  const mockTicketId = 'ticket-789';

  const mockFeedback = {
    id: 'feedback-001',
    ticketId: mockTicketId,
    tenantId: mockTenantId,
    userId: mockUserId,
    correctedType: 'bug',
    correctedSeverity: 'high',
    originalType: 'feature_request',
    originalSeverity: 'medium',
    comment: 'This is actually a bug, not a feature request',
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
  };

  const mockFeedbackService = {
    create: jest.fn().mockResolvedValue(mockFeedback),
    findByTicket: jest.fn().mockResolvedValue([mockFeedback]),
    findOne: jest.fn().mockResolvedValue(mockFeedback),
    update: jest.fn().mockResolvedValue({ ...mockFeedback, comment: 'Updated comment' }),
    remove: jest.fn().mockResolvedValue(mockFeedback),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeedbackController],
      providers: [{ provide: FeedbackService, useValue: mockFeedbackService }],
    }).compile();

    controller = module.get<FeedbackController>(FeedbackController);
    feedbackService = module.get(FeedbackService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create classification feedback for a ticket', async () => {
      const dto: CreateFeedbackDto = {
        ticketId: mockTicketId,
        field: 'type',
        originalValue: 'feature_request',
        correctedValue: 'bug',
      };

      const req = { user: { id: mockUserId } };

      const result = await controller.create(mockTenantId, dto, req as any);

      expect(result).toEqual(mockFeedback);
      expect(feedbackService.create).toHaveBeenCalledWith(mockTenantId, mockUserId, dto);
    });

    it('should create feedback without corrected value', async () => {
      const dto: CreateFeedbackDto = {
        ticketId: mockTicketId,
        field: 'severity',
        originalValue: 'high',
      };

      const req = { user: { id: mockUserId } };

      await controller.create(mockTenantId, dto, req as any);

      expect(feedbackService.create).toHaveBeenCalledWith(mockTenantId, mockUserId, dto);
    });

    it('should extract userId from request', async () => {
      const dto: CreateFeedbackDto = {
        ticketId: mockTicketId,
        field: 'type',
        correctedValue: 'question',
      };

      const req = { user: { id: 'different-user-id' } };

      await controller.create(mockTenantId, dto, req as any);

      expect(feedbackService.create).toHaveBeenCalledWith(mockTenantId, 'different-user-id', dto);
    });
  });

  describe('findByTicket', () => {
    it('should return feedback list for a ticket', async () => {
      const result = await controller.findByTicket(mockTenantId, mockTicketId);

      expect(result).toEqual([mockFeedback]);
      expect(feedbackService.findByTicket).toHaveBeenCalledWith(mockTicketId, mockTenantId);
    });

    it('should return empty array when no feedback exists', async () => {
      mockFeedbackService.findByTicket.mockResolvedValue([]);

      const result = await controller.findByTicket(mockTenantId, mockTicketId);

      expect(result).toEqual([]);
    });

    it('should handle different ticket IDs', async () => {
      const differentTicketId = 'ticket-999';

      await controller.findByTicket(mockTenantId, differentTicketId);

      expect(feedbackService.findByTicket).toHaveBeenCalledWith(differentTicketId, mockTenantId);
    });
  });

  describe('findOne', () => {
    it('should return single feedback by ID', async () => {
      const feedbackId = 'feedback-001';

      const result = await controller.findOne(mockTenantId, feedbackId);

      expect(result).toEqual(mockFeedback);
      expect(feedbackService.findOne).toHaveBeenCalledWith(feedbackId, mockTenantId);
    });

    it('should handle non-existent feedback ID', async () => {
      const nonExistentId = 'feedback-999';
      mockFeedbackService.findOne.mockResolvedValue(null);

      const result = await controller.findOne(mockTenantId, nonExistentId);

      expect(result).toBeNull();
      expect(feedbackService.findOne).toHaveBeenCalledWith(nonExistentId, mockTenantId);
    });
  });

  describe('update', () => {
    it('should update feedback', async () => {
      const feedbackId = 'feedback-001';
      const dto: UpdateFeedbackDto = {
        correctedValue: 'critical',
      };

      const result = await controller.update(mockTenantId, feedbackId, dto);

      expect(result).toEqual({ ...mockFeedback, comment: 'Updated comment' });
      expect(feedbackService.update).toHaveBeenCalledWith(feedbackId, mockTenantId, dto);
    });

    it('should update corrected value', async () => {
      const feedbackId = 'feedback-001';
      const dto: UpdateFeedbackDto = {
        correctedValue: 'bug',
      };

      await controller.update(mockTenantId, feedbackId, dto);

      expect(feedbackService.update).toHaveBeenCalledWith(feedbackId, mockTenantId, dto);
    });

    it('should update original value', async () => {
      const feedbackId = 'feedback-001';
      const dto: UpdateFeedbackDto = {
        originalValue: 'feature_request',
      };

      await controller.update(mockTenantId, feedbackId, dto);

      expect(feedbackService.update).toHaveBeenCalledWith(feedbackId, mockTenantId, dto);
    });

    it('should update comment', async () => {
      const feedbackId = 'feedback-001';
      const dto: UpdateFeedbackDto = {
        correctedValue: 'medium',
      };

      await controller.update(mockTenantId, feedbackId, dto);

      expect(feedbackService.update).toHaveBeenCalledWith(feedbackId, mockTenantId, dto);
    });
  });

  describe('remove', () => {
    it('should delete feedback', async () => {
      const feedbackId = 'feedback-001';

      const result = await controller.remove(mockTenantId, feedbackId);

      expect(result).toEqual(mockFeedback);
      expect(feedbackService.remove).toHaveBeenCalledWith(feedbackId, mockTenantId);
    });

    it('should handle deletion of non-existent feedback', async () => {
      const feedbackId = 'feedback-999';
      mockFeedbackService.remove.mockResolvedValue(null);

      const result = await controller.remove(mockTenantId, feedbackId);

      expect(result).toBeNull();
      expect(feedbackService.remove).toHaveBeenCalledWith(feedbackId, mockTenantId);
    });
  });
});
