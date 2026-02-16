import { Test, TestingModule } from '@nestjs/testing';
import { AutoResponseService } from '../../../src/modules/tickets/services/auto-response.service';
import { ResolutionSummaryService } from '../../../src/modules/tickets/services/resolution-summary.service';
import { TicketTimelineService } from '../../../src/modules/tickets/services/ticket-timeline.service';
import { NotificationService } from '../../../src/modules/notifications/notification.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('AutoResponseService', () => {
  let service: AutoResponseService;
  let prismaService: PrismaService;
  let resolutionSummaryService: ResolutionSummaryService;
  let ticketTimelineService: TicketTimelineService;
  let notificationService: NotificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutoResponseService,
        {
          provide: PrismaService,
          useValue: {
            ticket: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            ticketMessage: {
              create: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: ResolutionSummaryService,
          useValue: {
            generateResolutionSummary: jest.fn(),
          },
        },
        {
          provide: TicketTimelineService,
          useValue: {
            recordEvent: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            dispatchNotification: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AutoResponseService>(AutoResponseService);
    prismaService = module.get<PrismaService>(PrismaService);
    resolutionSummaryService = module.get<ResolutionSummaryService>(ResolutionSummaryService);
    ticketTimelineService = module.get<TicketTimelineService>(TicketTimelineService);
    notificationService = module.get<NotificationService>(NotificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleTicketMerged', () => {
    const mockTicket = {
      id: 'ticket-123',
      tenantId: 'tenant-123',
      applicationId: 'app-123',
      title: 'Login issue',
      description: 'Cannot login',
      type: 'bug',
      severity: 'high',
      publicId: 'PUB123',
      agentTasks: [
        {
          prNumber: 42,
          prUrl: 'https://github.com/org/repo/pull/42',
          branchName: 'fix/login',
        },
      ],
    };

    const mockSummary = {
      summary: 'Fixed login issue',
      changes: ['Updated auth flow'],
      version: 'v1.2.0',
    };

    it('should handle ticket merged successfully', async () => {
      jest.spyOn(prismaService.ticket, 'findUnique').mockResolvedValue(mockTicket as any);
      jest.spyOn(resolutionSummaryService, 'generateResolutionSummary').mockResolvedValue(mockSummary);
      jest.spyOn(prismaService, '$transaction').mockResolvedValue([null, null] as any);
      jest.spyOn(notificationService, 'dispatchNotification').mockResolvedValue(undefined);
      jest.spyOn(ticketTimelineService, 'recordEvent').mockResolvedValue(undefined);

      await service.handleTicketMerged('ticket-123', 'tenant-123');

      expect(prismaService.ticket.findUnique).toHaveBeenCalledWith({
        where: { id: 'ticket-123' },
        include: {
          agentTasks: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      expect(resolutionSummaryService.generateResolutionSummary).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'ticket-123',
          title: 'Login issue',
        }),
        expect.objectContaining({
          prNumber: 42,
        }),
      );

      expect(prismaService.$transaction).toHaveBeenCalled();
      expect(notificationService.dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          ticketId: 'ticket-123',
          tenantId: 'tenant-123',
          eventType: 'ticket_resolved',
        }),
      );
      expect(ticketTimelineService.recordEvent).toHaveBeenCalledWith(
        'ticket-123',
        'tenant-123',
        'resolution_sent',
        expect.any(Object),
      );
    });

    it('should handle ticket not found gracefully', async () => {
      jest.spyOn(prismaService.ticket, 'findUnique').mockResolvedValue(null);

      await service.handleTicketMerged('nonexistent', 'tenant-123');

      expect(resolutionSummaryService.generateResolutionSummary).not.toHaveBeenCalled();
      expect(prismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should use provided PR details if passed', async () => {
      jest.spyOn(prismaService.ticket, 'findUnique').mockResolvedValue({
        ...mockTicket,
        agentTasks: [],
      } as any);
      jest.spyOn(resolutionSummaryService, 'generateResolutionSummary').mockResolvedValue(mockSummary);
      jest.spyOn(prismaService, '$transaction').mockResolvedValue([null, null] as any);

      const prDetails = {
        prNumber: 99,
        prUrl: 'https://github.com/org/repo/pull/99',
        branchName: 'custom-branch',
      };

      await service.handleTicketMerged('ticket-123', 'tenant-123', prDetails);

      expect(resolutionSummaryService.generateResolutionSummary).toHaveBeenCalledWith(
        expect.any(Object),
        prDetails,
      );
    });

    it('should handle errors gracefully', async () => {
      jest.spyOn(prismaService.ticket, 'findUnique').mockRejectedValue(new Error('DB error'));

      await expect(
        service.handleTicketMerged('ticket-123', 'tenant-123'),
      ).resolves.not.toThrow();
    });
  });
});
