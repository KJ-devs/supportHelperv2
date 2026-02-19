import { Test, TestingModule } from '@nestjs/testing';
import { FeedbackController } from '../../../src/modules/feedback/feedback.controller';
import { FeedbackService } from '../../../src/modules/feedback/feedback.service';

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
    it('should create feedback', async () => {
      const dto = { ticketId: 'ticket-123', field: 'severity', originalValue: 'low', correctedValue: 'high' };
      const req = { user: { id: 'user-123' } };
      (feedbackService.create as jest.Mock).mockResolvedValue(mockFeedback);

      const result = await controller.create('tenant-123', dto as unknown, req as unknown);

      expect(feedbackService.create).toHaveBeenCalledWith('tenant-123', 'user-123', dto);
      expect(result).toEqual(mockFeedback);
    });
  });

  describe('findByTicket', () => {
    it('should return feedback list for ticket', async () => {
      (feedbackService.findByTicket as jest.Mock).mockResolvedValue([mockFeedback]);

      const result = await controller.findByTicket('tenant-123', 'ticket-123');

      expect(feedbackService.findByTicket).toHaveBeenCalledWith('ticket-123', 'tenant-123');
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should return single feedback', async () => {
      (feedbackService.findOne as jest.Mock).mockResolvedValue(mockFeedback);

      const result = await controller.findOne('tenant-123', 'fb-123');

      expect(feedbackService.findOne).toHaveBeenCalledWith('fb-123', 'tenant-123');
      expect(result).toEqual(mockFeedback);
    });
  });

  describe('update', () => {
    it('should update feedback', async () => {
      const dto = { correctedValue: 'critical' };
      (feedbackService.update as jest.Mock).mockResolvedValue({ ...mockFeedback, correctedValue: 'critical' });

      const result = await controller.update('tenant-123', 'fb-123', dto as unknown);

      expect(feedbackService.update).toHaveBeenCalledWith('fb-123', 'tenant-123', dto);
    });
  });

  describe('remove', () => {
    it('should remove feedback', async () => {
      (feedbackService.remove as jest.Mock).mockResolvedValue({ success: true });

      const result = await controller.remove('tenant-123', 'fb-123');

      expect(feedbackService.remove).toHaveBeenCalledWith('fb-123', 'tenant-123');
      expect(result).toEqual({ success: true });
    });
  });
});
